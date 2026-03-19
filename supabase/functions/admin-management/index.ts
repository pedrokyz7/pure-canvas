import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { action, email, password, full_name, phone, target_user_id, role } = await req.json();

    if (action === "setup") {
      // Setup is disabled after initial creation
      return new Response(JSON.stringify({ error: "Setup desabilitado" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Check if super_admin already exists
      const { data: existingRoles } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");

      if (existingRoles && existingRoles.length > 0) {
        return new Response(JSON.stringify({ error: "Super admin já existe" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { full_name: full_name || "Super Admin", role: "super_admin" },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabaseAdmin.from("user_roles").insert({ user_id: newUser.user.id, role: "super_admin" });

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // All other actions require super_admin auth
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const isSuperAdmin = callerRoles?.some((r: any) => r.role === "super_admin");
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Acesso restrito a super administradores" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "list_all_users") {
      // Get all user roles
      const { data: allRoles } = await supabaseAdmin.from("user_roles").select("user_id, role");
      const userIds = [...new Set((allRoles || []).map((r: any) => r.user_id))];

      if (userIds.length === 0) {
        return new Response(JSON.stringify({ users: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name, phone, is_available, avatar_url, is_frozen")
        .in("user_id", userIds);

      const users = [];
      for (const id of userIds) {
        const { data: { user: u } } = await supabaseAdmin.auth.admin.getUserById(id);
        const profile = profiles?.find((p: any) => p.user_id === id);
        const userRoles = allRoles?.filter((r: any) => r.user_id === id).map((r: any) => r.role) || [];
        users.push({
          user_id: id,
          full_name: profile?.full_name || "",
          phone: profile?.phone || "",
          email: u?.email || "",
          is_available: profile?.is_available ?? true,
          avatar_url: profile?.avatar_url || "",
          is_frozen: profile?.is_frozen ?? false,
          roles: userRoles,
          created_at: u?.created_at || "",
        });
      }

      return new Response(JSON.stringify({ users }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete_user") {
      if (!target_user_id) {
        return new Response(JSON.stringify({ error: "target_user_id é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (target_user_id === caller.id) {
        return new Response(JSON.stringify({ error: "Você não pode remover a si mesmo" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabaseAdmin.from("user_roles").delete().eq("user_id", target_user_id);
      await supabaseAdmin.from("appointments").delete().eq("client_id", target_user_id);
      await supabaseAdmin.from("appointments").delete().eq("barber_id", target_user_id);
      await supabaseAdmin.from("services").delete().eq("barber_id", target_user_id);
      await supabaseAdmin.from("barber_schedules").delete().eq("barber_id", target_user_id);
      await supabaseAdmin.from("profiles").delete().eq("user_id", target_user_id);
      await supabaseAdmin.auth.admin.deleteUser(target_user_id);

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update_user") {
      if (!target_user_id) {
        return new Response(JSON.stringify({ error: "target_user_id é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const updates: Record<string, any> = {};
      if (email) updates.email = email;
      if (password) updates.password = password;
      if (full_name) {
        updates.user_metadata = { full_name };
        await supabaseAdmin.from("profiles").update({ full_name }).eq("user_id", target_user_id);
      }
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(target_user_id, updates);
        if (updateError) {
          return new Response(JSON.stringify({ error: updateError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "get_stats") {
      // Global stats
      const { data: allAppointments } = await supabaseAdmin.from("appointments").select("*");
      const { data: allRoles } = await supabaseAdmin.from("user_roles").select("user_id, role");

      const totalBarbers = allRoles?.filter((r: any) => r.role === "barber").length || 0;
      const totalAdmins = allRoles?.filter((r: any) => r.role === "admin").length || 0;
      const totalClients = allRoles?.filter((r: any) => r.role === "client").length || 0;
      const totalAppointments = allAppointments?.length || 0;
      const totalRevenue = allAppointments
        ?.filter((a: any) => a.payment_status === "paid")
        .reduce((sum: number, a: any) => sum + Number(a.price || 0), 0) || 0;

      return new Response(JSON.stringify({ totalBarbers, totalAdmins, totalClients, totalAppointments, totalRevenue }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "freeze_account" || action === "unfreeze_account") {
      if (!target_user_id) {
        return new Response(JSON.stringify({ error: "target_user_id é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const frozen = action === "freeze_account";

      // Freeze the admin
      await supabaseAdmin.from("profiles").update({ is_frozen: frozen }).eq("user_id", target_user_id);

      // Find all barbers managed by this admin
      const { data: managedProfiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("admin_id", target_user_id);

      if (managedProfiles && managedProfiles.length > 0) {
        const managedIds = managedProfiles.map((p: any) => p.user_id);
        await supabaseAdmin.from("profiles").update({ is_frozen: frozen }).in("user_id", managedIds);
      }

      const count = (managedProfiles?.length || 0) + 1;
      return new Response(JSON.stringify({ success: true, frozen, affected_count: count }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
