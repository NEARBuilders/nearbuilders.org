import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { sessionQueryOptions, useAuthClient } from "@/app";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { nearProfileOptions } from "@/lib/queries/builders";

export function UserNav() {
  const auth = useAuthClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: session } = useQuery(sessionQueryOptions(auth));
  const nearAccountId = auth.near.getAccountId();
  const { data: profile } = useQuery(nearProfileOptions(auth, nearAccountId ?? ""));
  const user = session?.user;

  const signOutMutation = useMutation({
    mutationFn: async () => {
      const { error } = await auth.signOut();
      if (error) {
        throw new Error(error.message || "Failed to sign out");
      }
      await auth.near.disconnect().catch(() => {});
    },
    onSuccess: async () => {
      queryClient.setQueryData(["session"], null);
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      navigate({ to: "/", replace: true });
    },
    onError: (error: Error) => {
      console.error("Sign out error:", error);
    },
  });

  if (!user) {
    return (
      <Button asChild size="sm" className="rounded-full">
        <Link to="/login">Connect</Link>
      </Button>
    );
  }

  const initials = (user.name || user.email || user.id).slice(0, 2).toUpperCase();
  const avatarUrl =
    profile?.image?.url ??
    (profile?.image?.ipfs_cid ? `https://ipfs.near.social/ipfs/${profile.image.ipfs_cid}` : null);

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="size-8 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Account menu"
          >
            <Avatar className="size-8">
              {avatarUrl && (
                <AvatarImage
                  src={avatarUrl}
                  alt={`${profile?.name || user.name || user.email || user.id} avatar`}
                  className="object-cover"
                />
              )}
              <AvatarFallback className="bg-primary text-xs font-bold text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">signed in as</p>
              <p className="truncate text-sm font-medium">{user.name || user.email || user.id}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/home">Home</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/settings">Settings</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={(event) => {
              event.preventDefault();
              signOutMutation.mutate();
            }}
            disabled={signOutMutation.isPending}
          >
            {signOutMutation.isPending ? "Signing out…" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
