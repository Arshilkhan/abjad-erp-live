import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { InvoiceConfigurationTab } from "@/components/invoice-configuration-tab";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — ABJAD ERP" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Configure invoice fields, company profile, and financial year." />
      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Invoice Configuration</TabsTrigger>
          <TabsTrigger value="company">Company Profile</TabsTrigger>
        </TabsList>
        <TabsContent value="config"><InvoiceConfigurationTab /></TabsContent>
        <TabsContent value="company"><CompanyProfile /></TabsContent>
      </Tabs>
    </>
  );
}

function CompanyProfile() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["company"],
    queryFn: async () => (await supabase.from("company_profile").select("*").limit(1).maybeSingle()).data,
  });
  const [state, setState] = useState<any>({});
  useEffect(() => { if (data) setState(data); }, [data]);


  const save = useMutation({
    mutationFn: async () => {
      const { id, created_at, updated_at, ...rest } = state;

      if (!rest.name?.trim()) {
        throw new Error("Please enter the company name.");
      }

      if (id) {
        // Existing company profile: update
        const { error } = await supabase
          .from("company_profile")
          .update(rest)
          .eq("id", id);

        if (error) throw error;
      } else {
        // First company profile: insert
        const { error } = await supabase
          .from("company_profile")
          .insert(rest);

        if (error) throw error;
      }
    },

    onSuccess: () => {
      toast.success("Company profile saved successfully");
      qc.invalidateQueries({ queryKey: ["company"] });
    },

    onError: (e: any) => {
      toast.error(e.message);
    },
  });


  const setField = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setState((s: any) => ({ ...s, [k]: e.target.value }));

  const field = (k: string, label: string, type: string = "text", full = false) => (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs" htmlFor={`cp-${k}`}>{label}</Label>
      <Input id={`cp-${k}`} type={type} value={state[k] ?? ""} onChange={setField(k)} />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Company Profile</CardTitle>
        <CardDescription>Appears on invoice header and footer.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {field("name", "Company Name")}
        {field("website", "Website")}
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Address</Label>
          <Textarea rows={2} value={state.address ?? ""} onChange={setField("address")} />
        </div>
        {field("city", "City")}
        {field("pincode", "Pincode")}
        {field("state", "State")}
        {field("state_code", "State Code")}
        {field("gst_number", "GST Number")}
        {field("pan_number", "PAN Number")}
        {field("mobile", "Mobile")}
        {field("alt_mobile", "Alt Mobile")}
        {field("email", "Email", "email")}
        {field("financial_year", "Financial Year")}
        <div className="col-span-2 grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
          <div className="col-span-2 text-sm font-semibold">Bank Details</div>
          {field("bank_name", "Bank Name")}
          {field("bank_branch", "Branch")}
          {field("bank_account", "Account Number")}
          {field("bank_ifsc", "IFSC")}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Declaration</Label>
          <Textarea rows={3} value={state.declaration ?? ""} onChange={setField("declaration")} />
        </div>
        <div className="col-span-2 flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save Profile"}</Button>
        </div>
      </CardContent>
    </Card>
  );
}