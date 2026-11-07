
BEGIN;

-- =========================================================
-- 1. TAX INVOICES
-- =========================================================

DROP POLICY IF EXISTS "invoices write" ON public.invoices;

CREATE POLICY "invoices write"
ON public.invoices
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_edit_panel('invoices')
  AND public.can_perform_document_action(
    'tax_invoice',
    'create'
  )
);

-- invoice_items already has separate INSERT, UPDATE and DELETE
-- policies. Keep those unchanged because editing replaces items.


-- =========================================================
-- 2. PROFORMA INVOICES
-- =========================================================

DROP POLICY IF EXISTS "performa insert" ON public.performa;

CREATE POLICY "performa insert"
ON public.performa
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_edit_panel('proforma-form')
  AND public.can_perform_document_action(
    'proforma',
    'create'
  )
);

-- Correct the existing Proforma panel reference.
DROP POLICY IF EXISTS "performa update" ON public.performa;

CREATE POLICY "performa update"
ON public.performa
FOR UPDATE
TO authenticated
USING (
  public.can_edit_panel('proforma-form')
)
WITH CHECK (
  public.can_edit_panel('proforma-form')
);

-- Replace the broad ALL policy with individual item policies.
DROP POLICY IF EXISTS "performa items write"
ON public.performa_items;

CREATE POLICY "performa items insert"
ON public.performa_items
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_edit_panel('proforma-form')
);

CREATE POLICY "performa items update"
ON public.performa_items
FOR UPDATE
TO authenticated
USING (
  public.can_edit_panel('proforma-form')
)
WITH CHECK (
  public.can_edit_panel('proforma-form')
);

CREATE POLICY "performa items delete"
ON public.performa_items
FOR DELETE
TO authenticated
USING (
  public.can_edit_panel('proforma-form')
);


-- =========================================================
-- 3. QUOTATIONS
-- =========================================================

DROP POLICY IF EXISTS "quotation insert" ON public.quotation;

CREATE POLICY "quotation insert"
ON public.quotation
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_edit_panel('quotations')
  AND public.can_perform_document_action(
    'quotation',
    'create'
  )
);

-- Replace broad ALL policy on quotation items.
DROP POLICY IF EXISTS "quotation items write"
ON public.quotation_items;

CREATE POLICY "quotation items insert"
ON public.quotation_items
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_edit_panel('quotations')
);

CREATE POLICY "quotation items update"
ON public.quotation_items
FOR UPDATE
TO authenticated
USING (
  public.can_edit_panel('quotations')
)
WITH CHECK (
  public.can_edit_panel('quotations')
);

CREATE POLICY "quotation items delete"
ON public.quotation_items
FOR DELETE
TO authenticated
USING (
  public.can_edit_panel('quotations')
);


-- =========================================================
-- 4. DELIVERY CHALLANS
-- =========================================================

DROP POLICY IF EXISTS "challan insert" ON public.challan;

CREATE POLICY "challan insert"
ON public.challan
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_edit_panel('challans')
  AND public.can_perform_document_action(
    'delivery_challan',
    'create'
  )
);

-- Replace broad ALL policy on challan items.
DROP POLICY IF EXISTS "challan items write"
ON public.challan_items;

CREATE POLICY "challan items insert"
ON public.challan_items
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_edit_panel('challans')
);

CREATE POLICY "challan items update"
ON public.challan_items
FOR UPDATE
TO authenticated
USING (
  public.can_edit_panel('challans')
)
WITH CHECK (
  public.can_edit_panel('challans')
);

CREATE POLICY "challan items delete"
ON public.challan_items
FOR DELETE
TO authenticated
USING (
  public.can_edit_panel('challans')
);

COMMIT;