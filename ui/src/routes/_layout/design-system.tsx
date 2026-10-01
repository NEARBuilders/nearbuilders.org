import { createFileRoute } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { Bold, Home, Italic, Settings } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AspectRatio,
  Avatar,
  AvatarFallback,
  BackLink,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  CommandCopy,
  ConfirmDialog,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  GithubIcon,
  InfoRow,
  Input,
  Label,
  Markdown,
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NewBadge,
  PageBreadcrumb,
  RadioGroup,
  RadioGroupItem,
  ScrollArea,
  SegmentedFilter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  Skeleton,
  Spinner,
  type Step,
  StepList,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components";

export const Route = createFileRoute("/_layout/design-system")({
  head: () => ({
    meta: [
      { title: "Design system | NEAR Builders" },
      {
        name: "description",
        content: "Every primitive in the components barrel that sibling apps consume.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DesignSystemPage,
});

type Row = { name: string; role: string };

const rows: Row[] = [
  { name: "Ada", role: "Maintainer" },
  { name: "Grace", role: "Reviewer" },
  { name: "Linus", role: "Contributor" },
];

const columns: ColumnDef<Row>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "role", header: "Role" },
];

const steps: Step[] = [
  { label: "Connect wallet", state: "success" },
  { label: "Sign message", state: "running" },
  { label: "Create account", state: "pending" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </section>
  );
}

function DesignSystemPage() {
  const [filter, setFilter] = useState<"all" | "open">("all");
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <TooltipProvider>
      <div className="mx-auto w-full max-w-5xl space-y-10 px-4 py-10">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Design system</h1>
          <p className="text-muted-foreground">
            Every generic primitive exported from the components barrel, rendered straight from it.
          </p>
        </header>

        <Section title="Button, Badge">
          <Button>Default</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Badge>Badge</Badge>
          <Badge variant="success">Success</Badge>
          <NewBadge createdAt={new Date().toISOString()} />
          <GithubIcon className="size-5" />
        </Section>

        <Section title="Card">
          <Card className="w-72">
            <CardHeader>
              <CardTitle>Card title</CardTitle>
              <CardDescription>Card description</CardDescription>
            </CardHeader>
            <CardContent>Card content</CardContent>
          </Card>
        </Section>

        <Section title="Form: Input, Textarea, Label, Field, Checkbox, RadioGroup, Select">
          <FieldGroup className="w-80">
            <Field>
              <FieldLabel htmlFor="ds-name">Name</FieldLabel>
              <Input id="ds-name" placeholder="Ada Lovelace" />
              <FieldDescription>Shown on your profile.</FieldDescription>
            </Field>
            <Field>
              <Label htmlFor="ds-bio">Bio</Label>
              <Textarea id="ds-bio" placeholder="Tell us about yourself" />
            </Field>
            <div className="flex items-center gap-2">
              <Checkbox id="ds-terms" />
              <Label htmlFor="ds-terms">Accept terms</Label>
            </div>
            <RadioGroup defaultValue="a">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="a" id="ds-ra" />
                <Label htmlFor="ds-ra">Option A</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="b" id="ds-rb" />
                <Label htmlFor="ds-rb">Option B</Label>
              </div>
            </RadioGroup>
            <Select defaultValue="one">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one">One</SelectItem>
                <SelectItem value="two">Two</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
        </Section>

        <Section title="Overlays: Dialog, Sheet, DropdownMenu, Tooltip, ConfirmDialog, toast">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dialog</DialogTitle>
                <DialogDescription>Dialog description</DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Open sheet</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Sheet</SheetTitle>
                <SheetDescription>Sheet description</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Menu</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Hover me</Button>
            </TooltipTrigger>
            <TooltipContent>Tooltip</TooltipContent>
          </Tooltip>
          <Button variant="outline" onClick={() => setConfirmOpen(true)}>
            Confirm
          </Button>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Are you sure?"
            description="This is a demo."
            onConfirm={() => setConfirmOpen(false)}
          />
          <Button variant="outline" onClick={() => toast.success("Toast")}>
            Toast
          </Button>
        </Section>

        <Section title="Data: Table, DataTable, Tabs, Avatar, Skeleton, Spinner">
          <Table className="w-72">
            <TableCaption>Table</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.name}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.role}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="w-72">
            <DataTable columns={columns} data={rows} />
          </div>
          <Tabs defaultValue="one" className="w-72">
            <TabsList>
              <TabsTrigger value="one">One</TabsTrigger>
              <TabsTrigger value="two">Two</TabsTrigger>
            </TabsList>
            <TabsContent value="one">First tab</TabsContent>
            <TabsContent value="two">Second tab</TabsContent>
          </Tabs>
          <Avatar>
            <AvatarFallback>AL</AvatarFallback>
          </Avatar>
          <Skeleton className="h-8 w-40" />
          <Spinner />
        </Section>

        <Section title="Layout: Separator, ScrollArea, AspectRatio, InfoRow, StepList, Markdown">
          <div className="w-72 space-y-2">
            <div>Above</div>
            <Separator />
            <div>Below</div>
          </div>
          <ScrollArea className="h-24 w-72 rounded-md border border-border p-3">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i}>Scrollable row {i + 1}</div>
            ))}
          </ScrollArea>
          <div className="w-48">
            <AspectRatio ratio={16 / 9} className="rounded-md bg-muted" />
          </div>
          <div className="w-72">
            <InfoRow label="Account" value="alice.near" mono />
          </div>
          <div className="w-72 space-y-2">
            <StepList steps={steps} />
          </div>
          <Markdown content={"**Markdown** with a [link](https://near.org)."} />
        </Section>

        <Section title="Controls: Toggle, ToggleGroup, SegmentedFilter">
          <Toggle aria-label="Bold">
            <Bold />
          </Toggle>
          <ToggleGroup type="single">
            <ToggleGroupItem value="bold" aria-label="Bold">
              <Bold />
            </ToggleGroupItem>
            <ToggleGroupItem value="italic" aria-label="Italic">
              <Italic />
            </ToggleGroupItem>
          </ToggleGroup>
          <SegmentedFilter
            ariaLabel="Filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "open", label: "Open" },
            ]}
          />
        </Section>

        <Section title="Navigation: Breadcrumb, PageBreadcrumb, BackLink, NavigationMenu, CommandCopy">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Design system</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <PageBreadcrumb parentLabel="Home" parentTo="/" current="Design system" />
          <BackLink to="/" />
          <NavigationMenu>
            <NavigationMenuList>
              <NavigationMenuItem>
                <NavigationMenuLink href="/">Home</NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
          <CommandCopy command="bun install" />
        </Section>

        <Section title="Sidebar">
          <SidebarProvider className="min-h-0 w-72">
            <Sidebar collapsible="none" className="rounded-md border border-border">
              <SidebarContent>
                <SidebarGroup>
                  <SidebarGroupLabel>Workspace</SidebarGroupLabel>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton isActive>
                        <Home /> Home
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton>
                        <Settings /> Settings
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroup>
              </SidebarContent>
            </Sidebar>
          </SidebarProvider>
        </Section>
      </div>
    </TooltipProvider>
  );
}
