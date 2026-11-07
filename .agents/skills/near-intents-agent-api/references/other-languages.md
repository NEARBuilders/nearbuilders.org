# Other languages (Go, Java/Kotlin, C#, Ruby, PHP, Elixir, …)

The API is plain HTTPS + JSON. Any language works; you need:

1. An HTTP client with per-request timeouts (65 s normal, 150 s for settlement writes).
2. JSON that can keep `intent.payload` verbatim (raw bytes or an order-preserving tree).
3. SHA-256, random bytes, base64url, hex — for grant tokens and idempotency keys.
4. Only if you sign on the server: ed25519 + borsh-style byte packing (NEAR owners) or
   secp256k1 + EIP-712 (EVM owners). See [signing.md](signing.md).

## Generate types from OpenAPI

```bash
curl -s https://api.agentsonintents.com/openapi.json -o openapi.json
# Go
oapi-codegen -generate types,client -package agentapi openapi.json > agentapi.gen.go
# Java / Kotlin / C# / PHP / Ruby
openapi-generator-cli generate -i openapi.json -g kotlin   -o ./agentapi
openapi-generator-cli generate -i openapi.json -g csharp   -o ./agentapi
```

Treat `intent.payload` and `signed_data.payload` as opaque JSON (`json.RawMessage`,
`JsonNode`, `JsonElement`) in generated models; typed re-serialization can reorder or drop
fields and break signature checks.

## Minimal client contract

```
headers:   X-API-Key, Content-Type: application/json, Accept: application/json
           + X-Grant-Token on grant endpoints, + Idempotency-Key on executions/deposit
success:   2xx JSON
error:     ≥400 JSON:API → raise {status, code=errors[0].code, detail, retryable, available_at, request_id, idempotency_key}
transport: raise with the idempotency key so the caller can retry with it
```

## Go example

```go
package agentapi

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const DefaultBaseURL = "https://api.agentsonintents.com"

type Client struct {
	BaseURL, APIKey, GrantToken string
	HTTP                        *http.Client
}

type APIError struct {
	Status         int
	Code, Detail   string
	Retryable      bool
	AvailableAt    string
	RequestID      string
	IdempotencyKey string
}

func (e *APIError) Error() string { return fmt.Sprintf("%d %s: %s", e.Status, e.Code, e.Detail) }

func New(apiKey string) *Client {
	return &Client{BaseURL: DefaultBaseURL, APIKey: apiKey, HTTP: &http.Client{Timeout: 150 * time.Second}}
}

func (c *Client) ForGrant(token string) *Client { cp := *c; cp.GrantToken = token; return &cp }

// Do sends one request. body may be nil, a value, or json.RawMessage (sent verbatim).
func (c *Client) Do(ctx context.Context, method, path string, body any, idemKey string, grant bool, out any) error {
	var reader *bytes.Reader
	if body != nil {
		raw, ok := body.(json.RawMessage)
		if !ok {
			var err error
			if raw, err = json.Marshal(body); err != nil {
				return err
			}
		}
		reader = bytes.NewReader(raw)
	} else {
		reader = bytes.NewReader(nil)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.BaseURL+path, reader)
	if err != nil {
		return err
	}
	req.Header.Set("X-API-Key", c.APIKey)
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if idemKey != "" {
		req.Header.Set("Idempotency-Key", idemKey)
	}
	if grant {
		req.Header.Set("X-Grant-Token", c.GrantToken)
	}
	res, err := c.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("transport (idempotency key %q): %w", idemKey, err)
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		var doc struct {
			Errors []struct {
				Code, Detail string
				Meta         struct {
					Retryable   bool   `json:"retryable"`
					AvailableAt string `json:"available_at"`
				}
			}
			Meta struct {
				RequestID string `json:"request_id"`
			}
		}
		_ = json.NewDecoder(res.Body).Decode(&doc)
		e := &APIError{Status: res.StatusCode, RequestID: doc.Meta.RequestID, IdempotencyKey: idemKey}
		if len(doc.Errors) > 0 {
			e.Code, e.Detail = doc.Errors[0].Code, doc.Errors[0].Detail
			e.Retryable, e.AvailableAt = doc.Errors[0].Meta.Retryable, doc.Errors[0].Meta.AvailableAt
		}
		return e
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(res.Body).Decode(out)
}

func NewGrantCredential() (token, commitment string) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	token = "ngt_" + base64.RawURLEncoding.EncodeToString(b)
	sum := sha256.Sum256([]byte(token))
	return token, hex.EncodeToString(sum[:])
}

func NewIdempotencyKey() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return "idem_" + hex.EncodeToString(b)
}
```

Owner intent round trip, keeping the payload verbatim:

```go
type Generated struct {
	CorrelationID string          `json:"correlation_id"`
	Type          string          `json:"type"`
	AgentID       string          `json:"agent_id"`
	Intent        json.RawMessage `json:"intent"`   // {standard, payload} — never re-marshal from a map
	Preview       json.RawMessage `json:"preview"`
	ExpiresAt     string          `json:"expires_at"`
}

var g Generated
err := c.Do(ctx, "POST", "/v1/generate-intent", request, NewIdempotencyKey(), false, &g)
// send g.Intent + g.Preview to the browser; receive signedData (json.RawMessage) back
submit := map[string]any{"type": g.Type, "correlation_id": g.CorrelationID, "signed_data": signedData}
err = c.Do(ctx, "POST", "/v1/submit-intent", submit, "", false, nil)
```

To add wallet output fields server-side without reordering the payload, decode `g.Intent` into a
`map[string]json.RawMessage` (the inner `payload` stays raw bytes), add `"signature"` etc., and
marshal that map: top-level key order does not matter, only the payload bytes do. When you
produce bytes you will **sign** (NEP-366 `args`), use `json.Compact` on the raw bytes or an
`Encoder` with `SetEscapeHTML(false)`: plain `json.Marshal` escapes `<`, `>`, `&` and would
differ from `JSON.stringify`.

Go signing building blocks: `crypto/ed25519` (NEAR keys: `ed25519.NewKeyFromSeed(seed[:32])`),
`github.com/mr-tron/base58`, `encoding/binary` (little-endian lengths), and for EVM
`github.com/ethereum/go-ethereum/signer/core/apitypes` (`TypedDataAndHash`) +
`crypto.Sign`. Validate against `assets/test-vectors.json`.

## Java / Kotlin notes

- `java.net.http.HttpClient` or OkHttp; Jackson `JsonNode` for payloads (keeps order).
- Grant token: `SecureRandom` 32 bytes → `Base64.getUrlEncoder().withoutPadding()`; SHA-256 via
  `MessageDigest`, hex lowercase.
- NEAR: `net.i2p.crypto:eddsa` or BouncyCastle Ed25519; EVM: web3j `StructuredDataEncoder` +
  `Sign.signMessage(hash, keyPair, false)`.

## C# notes

- `HttpClient` + `System.Text.Json` `JsonNode`; serialize with
  `JavaScriptEncoder.UnsafeRelaxedJsonEscaping` when you must re-emit JSON you will sign.
- NEAR: `NSec.Cryptography` Ed25519; EVM: Nethereum `Eip712TypedDataSigner`.

## Porting checklist

- [ ] Base URL configurable; default hosted.
- [ ] API key from secret storage; grant tokens per client instance.
- [ ] Idempotency key generated, persisted, sent; returned on errors.
- [ ] JSON:API error mapping with `code`, `retryable`, `available_at`, `request_id`.
- [ ] Long-poll status helper with deadline.
- [ ] Payload pass-through without reordering; tests against `test-vectors.json` if signing.
- [ ] Amount conversion with integer/decimal types only.
