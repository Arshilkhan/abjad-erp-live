
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { PANELS } from "@/lib/panels";
import {
  listAppUsers,
  createAppUser,
  setUserPanels,
  deleteAppUser,
} from "@/lib/admin-users.functions";
import { Trash2, ChevronDown } from "lucide-react";
import type {
  DocumentAction,
  DocumentPermissions,
} from "@/lib/auth-context";
import type { SalesDocumentKind } from "@/lib/sales-documents";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "Users & Permissions — ABJAD ERP" },
      {
        name: "description",
        content:
          "Create users and control which ERP panels and document actions each user can access.",
      },
      { property: "og:title", content: "Users & Permissions — ABJAD ERP" },
      {
        property: "og:description",
        content:
          "Create users and control which ERP panels and document actions each user can access.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsersPanel,
});

const DOCUMENT_PERMISSION_CONFIG: {
  kind: SalesDocumentKind;
  panel: string;
  label: string;
}[] = [
  {
    kind: "tax_invoice",
    panel: "invoices",
    label: "Invoices",
  },
  {
    kind: "proforma",
    panel: "proforma-form",
    label: "Proforma Invoices",
  },
  {
    kind: "quotation",
    panel: "quotations",
    label: "Quotations",
  },
  {
    kind: "delivery_challan",
    panel: "challans",
    label: "Challans",
  },
];

const ACTION_OPTIONS: {
  value: DocumentAction;
  label: string;
}[] = [
  { value: "create", label: "Create" },
  { value: "duplicate", label: "Duplicate" },
  { value: "cancel", label: "Cancel" },
  { value: "download_pdf", label: "Download PDF" },
];

type UserPermissionRecord = {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  roles: string[];
  panels: string[];
  documentPermissions: DocumentPermissions;
};

const EMPTY_PERMISSIONS: DocumentPermissions = {
  tax_invoice: [],
  proforma: [],
  quotation: [],
  delivery_challan: [],
};

function UsersPanel() {
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();

  const fetchUsers = useServerFn(listAppUsers);
  const createFn = useServerFn(createAppUser);
  const saveFn = useServerFn(setUserPanels);
  const delFn = useServerFn(deleteAppUser);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [newPanels, setNewPanels] = useState<string[]>([]);

  const [draftPanels, setDraftPanels] = useState<Record<string, string[]>>(
    {}
  );

  const [draftActions, setDraftActions] = useState<
    Record<string, DocumentPermissions>
  >({});

  const { data: users, isLoading } = useQuery({
    queryKey: ["app-users"],
    queryFn: () => fetchUsers(),
    enabled: isAdmin,
  });

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          email,
          password,
          fullName,
          panels: newPanels,
        },
      }),
    onSuccess: () => {
      toast.success("User created");
      setEmail("");
      setPassword("");
      setFullName("");
      setNewPanels([]);
      qc.invalidateQueries({ queryKey: ["app-users"] });
    },
    onError: (e: any) =>
      toast.error(e?.message ?? "Could not create user"),
  });

  const save = useMutation({
    mutationFn: (v: {
      userId: string;
      panels: string[];
      documentPermissions: DocumentPermissions;
    }) => saveFn({ data: v }),
    onSuccess: () => {
      toast.success("Permissions updated");
      qc.invalidateQueries({ queryKey: ["app-users"] });
    },
    onError: (e: any) =>
      toast.error(e?.message ?? "Could not save permissions"),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => delFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["app-users"] });
    },
    onError: (e: any) =>
      toast.error(e?.message ?? "Could not delete user"),
  });

  const toggle = (list: string[], key: string) =>
    list.includes(key)
      ? list.filter((item) => item !== key)
      : [...list, key];

  const panelsFor = (user: UserPermissionRecord) =>
    draftPanels[user.id] ?? user.panels;

  const actionsFor = (user: UserPermissionRecord) =>
    draftActions[user.id] ?? user.documentPermissions ?? EMPTY_PERMISSIONS;

  const togglePanel = (
    user: UserPermissionRecord,
    panel: string
  ) => {
    const currentlySelected = panelsFor(user);
    const nextPanels = toggle(currentlySelected, panel);

    setDraftPanels((current) => ({
      ...current,
      [user.id]: nextPanels,
    }));

    // When a document panel is disabled, clear its action grants.
    const affectedDocument = DOCUMENT_PERMISSION_CONFIG.find(
      (document) => document.panel === panel
    );

    if (affectedDocument && !nextPanels.includes(panel)) {
      const nextActions = {
        ...actionsFor(user),
        [affectedDocument.kind]: [],
      };

      setDraftActions((current) => ({
        ...current,
        [user.id]: nextActions,
      }));
    }
  };

  const toggleAction = (
    user: UserPermissionRecord,
    kind: SalesDocumentKind,
    action: DocumentAction
  ) => {
    const current = actionsFor(user);

    setDraftActions((previous) => ({
      ...previous,
      [user.id]: {
        ...current,
        [kind]: toggle(current[kind] ?? [], action),
      },
    }));
  };

  const saveUserPermissions = (user: UserPermissionRecord) => {
    save.mutate({
      userId: user.id,
      panels: panelsFor(user),
      documentPermissions: actionsFor(user),
    });
  };

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Loading</p>
    );
  }

  if (!isAdmin) {
    return (
      <p className="text-sm text-muted-foreground"> You don't have access to this section.</p>
    );
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="Create users and control which panels and document actions each one can access."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Create new user</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="nu-name">Full name</Label>
              <Input
                id="nu-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nu-email">Email</Label>
              <Input
                id="nu-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nu-pass">Password</Label>
              <Input
                id="nu-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Panel access
            </p>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {PANELS.map((panel) => (
                <label
                  key={panel.key}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={newPanels.includes(panel.key)}
                    onCheckedChange={() =>
                      setNewPanels((current) =>
                        toggle(current, panel.key)
                      )
                    }
                  />
                  {panel.label}
                </label>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            New users receive no document action permissions by default.
            You can assign them after creating the account.
          </p>

          <Button
            onClick={() => create.mutate()}
            disabled={create.isPending}
          >
            {create.isPending ? "Creating…" : "Create user"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Existing users</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading users…
            </p>
          ) : (users ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No users yet.
            </p>
          ) : (
            (users ?? []).map((u: UserPermissionRecord) => (
              <div key={u.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {u.full_name ?? u.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {u.email}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {u.roles.map((role) => (
                      <Badge
                        key={role}
                        variant="outline"
                        className="text-[10px] uppercase"
                      >
                        {role.replace("_", " ")}
                      </Badge>
                    ))}

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete ${u.email}?`)) {
                          remove.mutate(u.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {u.roles.some(
                  (role) =>
                    role === "admin" || role === "super_admin"
                ) ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Admins have unrestricted access to all panels and
                    document actions.
                  </p>
                ) : (
                  <>
                    <div className="mt-3">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Panel access
                      </p>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                        {PANELS.map((panel) => (
                          <label
                            key={panel.key}
                            className="flex items-center gap-2 text-sm"
                          >
                            <Checkbox
                              checked={panelsFor(u).includes(panel.key)}
                              onCheckedChange={() =>
                                togglePanel(u, panel.key)
                              }
                            />
                            {panel.label}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Document action permissions
                      </p>

                      {DOCUMENT_PERMISSION_CONFIG.map((document) => {
                        const panelEnabled = panelsFor(u).includes(
                          document.panel
                        );

                        const selectedActions =
                          actionsFor(u)[document.kind] ?? [];

                        return (
                          <details
                            key={document.kind}
                            className="rounded-md border"
                          >
                            <summary
                              className={`flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm ${
                                !panelEnabled
                                  ? "text-muted-foreground"
                                  : ""
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <ChevronDown className="h-4 w-4" />
                                {document.label}
                              </span>

                              <span className="text-xs text-muted-foreground">
                                {!panelEnabled
                                  ? "Enable panel first"
                                  : `${selectedActions.length}/4 actions`}
                              </span>
                            </summary>

                            <div className="grid grid-cols-2 gap-3 border-t px-3 py-3 sm:grid-cols-4">
                              {ACTION_OPTIONS.map((action) => (
                                <label
                                  key={action.value}
                                  className={`flex items-center gap-2 text-sm ${
                                    !panelEnabled
                                      ? "cursor-not-allowed opacity-50"
                                      : ""
                                  }`}
                                >
                                  <Checkbox
                                    checked={selectedActions.includes(
                                      action.value
                                    )}
                                    disabled={!panelEnabled}
                                    onCheckedChange={() =>
                                      toggleAction(
                                        u,
                                        document.kind,
                                        action.value
                                      )
                                    }
                                  />
                                  {action.label}
                                </label>
                              ))}
                            </div>
                          </details>
                        );
                      })}
                    </div>

                    <Button
                      size="sm"
                      className="mt-4"
                      disabled={save.isPending}
                      onClick={() => saveUserPermissions(u)}
                    >
                      {save.isPending
                        ? "Saving…"
                        : "Save permissions"}
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
