# Ticket Title

### Context
This is a child ticket of #<epic>, blocked by #<dependency>, to <purpose>. <motivation and architectural context — what problem does this solve, what existing patterns or plugins does it follow, what does it depend on?>

### Overview
Create <file path / route / plugin>. You will need to implement <specific pieces>. <How it connects to other tickets or plugins>. <Framework or pattern to follow>.

### Acceptance Criteria
- [ ] <concrete deliverable 1>
- [ ] <concrete deliverable 2>
  - <sub-item if needed>
  - <sub-item if needed>
- [ ] <edge cases / states: loading skeleton, empty state, error handling>
- [ ] Must follow everything-dev and every-plugin best practices

### Notes
- [ ] Types should not be re-instated — infer them directly from the apiClient through the oRPC contract. Use `Awaited<ReturnType<typeof apiClient.<plugin>.<method>>>` or the generated types from `bos types gen` in `ui/src/lib/api-types.gen.ts`.
