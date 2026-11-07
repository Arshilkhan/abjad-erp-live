
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PANELS } from "@/lib/panels";
import type { SalesDocumentKind } from "@/lib/sales-documents";

type DocumentAction =
  | "create"
  | "duplicate"
  | "cancel"
  | "download_pdf";

type DocumentPermissions = Record<SalesDocumentKind, DocumentAction[]>;

type DocumentPermissionsInput = Partial<DocumentPermissions>;

const DOCUMENT_PANEL_MAP: Record<SalesDocumentKind, string> = {
  tax_invoice: "invoices",
  proforma: "proforma-form",
  quotation: "quotations",
  delivery_challan: "challans",
};

const DOCUMENT_KINDS = Object.keys(
  DOCUMENT_PANEL_MAP
) as SalesDocumentKind[];

const DOCUMENT_ACTIONS: DocumentAction[] = [
  "create",
  "duplicate",
  "cancel",
  "download_pdf",
];

async function assertAdmin(context: {
  supabase: any;
  userId: string;
}) {
  const [superAdmin, admin] = await Promise.all([
    context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    }),
    context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    }),
  ]);

  if (superAdmin.error || admin.error) {
    throw new Error("Could not verify administrator permissions");
  }

  if (!superAdmin.data && !admin.data) {
    throw new Error("Forbidden: admin access required");
  }
}

function validatePanels(panels: string[]): string[] {
  if (!Array.isArray(panels)) {
    throw new Error("Invalid panel permissions");
  }

  const allowedPanels = new Set(PANELS.map((panel) => panel.key));

  for (const panel of panels) {
    if (!allowedPanels.has(panel as any)) {
      throw new Error(`Invalid panel: ${panel}`);
    }
  }

  return [...new Set(panels)];
}

function validateDocumentPermissions(
  panels: string[],
  permissions: DocumentPermissionsInput
) {
  const result: {
    document_kind: SalesDocumentKind;
    action: DocumentAction;
  }[] = [];

  for (const kind of DOCUMENT_KINDS) {
    const requestedActions = permissions?.[kind] ?? [];

    if (!Array.isArray(requestedActions)) {
      throw new Error(`Invalid permissions for ${kind}`);
    }

    const uniqueActions = [...new Set(requestedActions)];

    for (const action of uniqueActions) {
      if (!DOCUMENT_ACTIONS.includes(action)) {
        throw new Error(`Invalid action permission: ${action}`);
      }
    }

    // Action permissions require the corresponding panel.
    if (!panels.includes(DOCUMENT_PANEL_MAP[kind])) {
      continue;
    }

    for (const action of uniqueActions) {
      result.push({
        document_kind: kind,
        action,
      });
    }
  }

  return result;
}

export const listAppUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as any);

    const { supabase } = context;

    const [
      profilesResult,
      rolesResult,
      panelsResult,
      actionsResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, created_at")
        .order("created_at"),

      supabase
        .from("user_roles")
        .select("user_id, role"),

      supabase
        .from("user_panel_permissions")
        .select("user_id, panel"),

      // Temporary any cast until Supabase types are regenerated.
      (supabase as any)
        .from("user_document_action_permissions")
        .select("user_id, document_kind, action"),
    ]);

    if (profilesResult.error) throw new Error(profilesResult.error.message);
    if (rolesResult.error) throw new Error(rolesResult.error.message);
    if (panelsResult.error) throw new Error(panelsResult.error.message);
    if (actionsResult.error) throw new Error(actionsResult.error.message);

    const profiles = profilesResult.data ?? [];
    const roles = rolesResult.data ?? [];
    const panels = panelsResult.data ?? [];
    const actions = actionsResult.data ?? [];

    return profiles.map((profile: any) => {
      const documentPermissions: DocumentPermissions = {
        tax_invoice: [],
        proforma: [],
        quotation: [],
        delivery_challan: [],
      };

      actions
        .filter((permission: any) => permission.user_id === profile.id)
        .forEach((permission: any) => {
          const kind = permission.document_kind as SalesDocumentKind;
          const action = permission.action as DocumentAction;

          if (DOCUMENT_KINDS.includes(kind)) {
            documentPermissions[kind].push(action);
          }
        });

      return {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        created_at: profile.created_at,

        roles: roles
          .filter((role: any) => role.user_id === profile.id)
          .map((role: any) => role.role as string),

        panels: panels
          .filter((panel: any) => panel.user_id === profile.id)
          .map((panel: any) => panel.panel as string),

        documentPermissions,
      };
    });
  });

export const createAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      email: string;
      password: string;
      fullName: string;
      panels: string[];
    }) => {
      if (!input.email?.includes("@")) {
        throw new Error("Valid email required");
      }

      if (!input.password || input.password.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }

      return {
        ...input,
        panels: validatePanels(input.panels),
      };
    }
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data: created, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          full_name: data.fullName || data.email,
        },
      });

    if (createError) throw new Error(createError.message);

    const userId = created.user!.id;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: userId,
        email: data.email,
        full_name: data.fullName || data.email,
      });

    if (profileError) {
      throw new Error(profileError.message);
    }

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        {
          user_id: userId,
          role: "viewer",
        },
        {
          onConflict: "user_id,role",
        }
      );

    if (roleError) {
      throw new Error(roleError.message);
    }

    if (data.panels.length > 0) {
      const { error: panelError } = await supabaseAdmin
        .from("user_panel_permissions")
        .insert(
          data.panels.map((panel) => ({
            user_id: userId,
            panel,
          }))
        );

      if (panelError) {
        throw new Error(panelError.message);
      }
    }

    // New users receive no document action permissions by default.
    return { id: userId };
  });

export const setUserPanels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      userId: string;
      panels: string[];
      documentPermissions?: DocumentPermissionsInput;
    }) => {
      if (!input.userId) {
        throw new Error("User ID is required");
      }

      const panels = validatePanels(input.panels);

      const documentPermissions = validateDocumentPermissions(
        panels,
        input.documentPermissions ?? {}
      );

      return {
        userId: input.userId,
        panels,
        documentPermissions,
      };
    }
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const adminDb = supabaseAdmin as any;

    // Replace existing panel permissions.
    const { error: deletePanelsError } = await adminDb
      .from("user_panel_permissions")
      .delete()
      .eq("user_id", data.userId);

    if (deletePanelsError) {
      throw new Error(deletePanelsError.message);
    }

    if (data.panels.length > 0) {
      const { error: insertPanelsError } = await adminDb
        .from("user_panel_permissions")
        .insert(
          data.panels.map((panel) => ({
            user_id: data.userId,
            panel,
          }))
        );

      if (insertPanelsError) {
        throw new Error(insertPanelsError.message);
      }
    }

    // Replace action permissions.
    const { error: deleteActionsError } = await adminDb
      .from("user_document_action_permissions")
      .delete()
      .eq("user_id", data.userId);

    if (deleteActionsError) {
      throw new Error(deleteActionsError.message);
    }

    if (data.documentPermissions.length > 0) {
      const { error: insertActionsError } = await adminDb
        .from("user_document_action_permissions")
        .insert(
          data.documentPermissions.map((permission) => ({
            user_id: data.userId,
            document_kind: permission.document_kind,
            action: permission.action,
          }))
        );

      if (insertActionsError) {
        throw new Error(insertActionsError.message);
      }
    }

    return { ok: true };
  });

export const deleteAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (!input.userId) {
      throw new Error("User ID is required");
    }

    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);

    if (data.userId === context.userId) {
      throw new Error("You cannot delete your own account");
    }

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { error } = await supabaseAdmin.auth.admin.deleteUser(
      data.userId
    );

    if (error) throw new Error(error.message);

    return { ok: true };
  });
