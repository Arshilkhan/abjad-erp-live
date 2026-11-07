import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_ROLES } from "@/lib/panels";
import type { SalesDocumentKind } from "@/lib/sales-documents";

export type DocumentAction =
  | "create"
  | "duplicate"
  | "cancel"
  | "download_pdf";

export type DocumentPermissions = Record<
  SalesDocumentKind,
  DocumentAction[]
>;

const DOCUMENT_PANEL_MAP: Record<SalesDocumentKind, string> = {
  tax_invoice: "invoices",
  proforma: "proforma-form",
  quotation: "quotations",
  delivery_challan: "challans",
};

const EMPTY_DOCUMENT_PERMISSIONS: DocumentPermissions = {
  tax_invoice: [],
  proforma: [],
  quotation: [],
  delivery_challan: [],
};

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  roles: string[];
  panels: string[];
  documentPermissions: DocumentPermissions;
  isAdmin: boolean;
  canAccess: (panel: string) => boolean;
  canPerform: (
    documentKind: SalesDocumentKind,
    action: DocumentAction
  ) => boolean;
  refreshAccess: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  roles: [],
  panels: [],
  documentPermissions: EMPTY_DOCUMENT_PERMISSIONS,
  isAdmin: false,
  canAccess: () => false,
  canPerform: () => false,
  refreshAccess: async () => { },
  signOut: async () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [panels, setPanels] = useState<string[]>([]);
  const [documentPermissions, setDocumentPermissions] =
    useState<DocumentPermissions>(EMPTY_DOCUMENT_PERMISSIONS);
  const [loading, setLoading] = useState(true);

  const loadAccess = async (userId: string) => {
    const [
      { data: rd, error: roleError },
      { data: pd, error: panelError },
      { data: ad, error: actionError },
    ] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("user_panel_permissions")
        .select("panel")
        .eq("user_id", userId),
      (supabase as any)
        .from("user_document_action_permissions")
        .select("document_kind, action")
        .eq("user_id", userId),
    ]);

    if (roleError) throw roleError;
    if (panelError) throw panelError;

    // An unavailable new permissions table should not prevent login.
    // No action permissions are granted when loading fails.
    if (actionError) {
      console.error("Could not load document action permissions:", actionError);
    }

    const nextRoles = (rd ?? []).map((r) => r.role as string);
    const nextPanels = (pd ?? []).map((p) => p.panel as string);

    const nextPermissions: DocumentPermissions = {
      tax_invoice: [],
      proforma: [],
      quotation: [],
      delivery_challan: [],
    };

    if (!actionError) {
      (ad ?? []).forEach(
        (permission: { document_kind: string; action: string }) => {
          const kind = permission.document_kind as SalesDocumentKind;
          const action = permission.action as DocumentAction;

          if (
            Object.prototype.hasOwnProperty.call(nextPermissions, kind) &&
            ["create", "duplicate", "cancel", "download_pdf"].includes(action)
          ) {
            nextPermissions[kind].push(action);
          }
        });
    }

    setRoles(nextRoles);
    setPanels(nextPanels);
    setDocumentPermissions(nextPermissions);
  };

  const refreshAccess = async () => {
    if (!user?.id) return;
    await loadAccess(user.id);
  };

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!active) return;

      // Always keep the latest authentication session and user.
      setSession(s);
      setUser(s?.user ?? null);

      // A token refresh is not a new login.
      // Do not reload permissions or show the full-page Loading screen.
      if (event === "TOKEN_REFRESHED") return;

      if (s?.user) {
        setLoading(true);

        setTimeout(() => {
          if (!active) return;

          void loadAccess(s.user.id)
            .catch((error) => {
              console.error("Could not load user permissions:", error);
              setRoles([]);
              setPanels([]);
              setDocumentPermissions(EMPTY_DOCUMENT_PERMISSIONS);
            })
            .finally(() => {
              if (active) setLoading(false);
            });
        }, 0);
      } else {
        setRoles([]);
        setPanels([]);
        setDocumentPermissions(EMPTY_DOCUMENT_PERMISSIONS);
        setLoading(false);
      }
    });


    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active) return;

      if (error) {
        console.error("Could not retrieve session:", error);
        setLoading(false);
        return;
      }

      const currentUser = data.session?.user ?? null;
      setSession(data.session);
      setUser(currentUser);

      if (currentUser) {
        try {
          await loadAccess(currentUser.id);
        } catch (err) {
          console.error("Could not load user permissions:", err);
          setRoles([]);
          setPanels([]);
          setDocumentPermissions(EMPTY_DOCUMENT_PERMISSIONS);
        }
      } else {
        setRoles([]);
        setPanels([]);
        setDocumentPermissions(EMPTY_DOCUMENT_PERMISSIONS);
      }

      if (active) setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isAdmin = roles.some((role) => ADMIN_ROLES.includes(role));

  const canAccess = (panel: string) =>
    isAdmin || panels.includes(panel);

  const canPerform = (
    documentKind: SalesDocumentKind,
    action: DocumentAction
  ) => {
    if (isAdmin) return true;

    const requiredPanel = DOCUMENT_PANEL_MAP[documentKind];

    if (!panels.includes(requiredPanel)) return false;

    return documentPermissions[documentKind]?.includes(action) ?? false;
  };

  return (
    <Ctx.Provider
      value={{
        user,
        session,
        loading,
        roles,
        panels,
        documentPermissions,
        isAdmin,
        canAccess,
        canPerform,
        refreshAccess,
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
