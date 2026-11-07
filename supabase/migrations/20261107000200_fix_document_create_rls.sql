BEGIN;

-- TAX INVOICES
-- A Create grant is sufficient; can_perform also verifies panel access.

DROP POLICY IF EXISTS "invoices write" ON public.invoices;

CREATE POLICY "invoices write"
ON public.invoices
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_perform_document_action('tax_invoice', 'create')
);

DROP POLICY IF EXISTS "invoice items insert" ON public.invoice_items;

CREATE POLICY "invoice items insert"
ON public.invoice_items
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_edit_panel('invoices')
  OR public.can_perform_document_action('tax_invoice', 'create')
);


-- PROFORMA INVOICES

DROP POLICY IF EXISTS "performa insert" ON public.performa;

CREATE POLICY "performa insert"
ON public.performa
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_perform_document_action('proforma', 'create')
);

DROP POLICY IF EXISTS "performa items insert" ON public.performa_items;

CREATE POLICY "performa items insert"
ON public.performa_items
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_edit_panel('proforma-form')
  OR public.can_perform_document_action('proforma', 'create')
);


-- QUOTATIONS

DROP POLICY IF EXISTS "quotation insert" ON public.quotation;

CREATE POLICY "quotation insert"
ON public.quotation
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_perform_document_action('quotation', 'create')
);

DROP POLICY IF EXISTS "quotation items insert" ON public.quotation_items;

CREATE POLICY "quotation items insert"
ON public.quotation_items
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_edit_panel('quotations')
  OR public.can_perform_document_action('quotation', 'create')
);


-- DELIVERY CHALLANS

DROP POLICY IF EXISTS "challan insert" ON public.challan;

CREATE POLICY "challan insert"
ON public.challan
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_perform_document_action('delivery_challan', 'create')
);

DROP POLICY IF EXISTS "challan items insert" ON public.challan_items;

CREATE POLICY "challan items insert"
ON public.challan_items
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_edit_panel('challans')
  OR public.can_perform_document_action('delivery_challan', 'create')
);

COMMIT;
