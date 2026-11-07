
-- Granular action permissions for sales documents.
-- Existing panel permissions remain the source of View access.

CREATE TABLE IF NOT EXISTS public.user_document_action_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  document_kind text NOT NULL CHECK (
    document_kind IN (
      'tax_invoice',
      'proforma',
      'quotation',
      'delivery_challan'
    )
  ),

  action text NOT NULL CHECK (
    action IN (
      'create',
      'duplicate',
      'cancel',
      'download_pdf'
    )
  ),

  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, document_kind, action)
);

CREATE INDEX IF NOT EXISTS idx_user_document_action_permissions_user
  ON public.user_document_action_permissions(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.user_document_action_permissions TO authenticated;

GRANT ALL
  ON public.user_document_action_permissions TO service_role;

ALTER TABLE public.user_document_action_permissions
  ENABLE ROW LEVEL SECURITY;

-- Users can read their own action permissions.
-- Admins can read all users' permissions.
CREATE POLICY "Users read own document action permissions"
ON public.user_document_action_permissions
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
);

-- Only admins and super admins can manage action permissions.
CREATE POLICY "Admins manage document action permissions"
ON public.user_document_action_permissions
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'super_admin')
);

-- Central permission check for server functions and RLS policies.
-- A user must have both:
-- 1. Access to the corresponding panel.
-- 2. The requested action permission.
-- Admins and super admins bypass both checks.

CREATE OR REPLACE FUNCTION public.can_perform_document_action(
  _document_kind text,
  _action text,
  _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _panel text;
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;

  IF _document_kind NOT IN (
    'tax_invoice',
    'proforma',
    'quotation',
    'delivery_challan'
  ) THEN
    RETURN false;
  END IF;

  IF _action NOT IN (
    'create',
    'duplicate',
    'cancel',
    'download_pdf'
  ) THEN
    RETURN false;
  END IF;

  -- Admins and super admins retain unrestricted access.
  IF public.has_role(_user_id, 'admin')
     OR public.has_role(_user_id, 'super_admin') THEN
    RETURN true;
  END IF;

  -- Map document kind to the existing panel key.
  _panel := CASE _document_kind
    WHEN 'tax_invoice' THEN 'invoices'
    WHEN 'proforma' THEN 'proforma-form'
    WHEN 'quotation' THEN 'quotations'
    WHEN 'delivery_challan' THEN 'challans'
  END;

  -- View access is always required.
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_panel_permissions p
    WHERE p.user_id = _user_id
      AND p.panel = _panel
  ) THEN
    RETURN false;
  END IF;

  -- Check the individual action grant.
  RETURN EXISTS (
    SELECT 1
    FROM public.user_document_action_permissions p
    WHERE p.user_id = _user_id
      AND p.document_kind = _document_kind
      AND p.action = _action
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_perform_document_action(text, text, uuid)
  TO authenticated, service_role;