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

    const roles = callerRoles?.map((r: any) => r.role) || [];
    const isBarberOrAdmin = roles.includes("barber") || roles.includes("admin");

    if (!isBarberOrAdmin) {
      return new Response(JSON.stringify({ error: "Apenas barbeiros podem gerenciar barbeiros" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { action, email, password, full_name, phone, barber_user_id, is_available } = await req.json();

    if (action === "create") {
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, role: "barber", phone: phone || null },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabaseAdmin.from("user_roles").insert({ user_id: newUser.user.id, role: "barber" });

      const { data: adminProfile } = await supabaseAdmin
        .from("profiles")
        .select("is_frozen")
        .eq("user_id", caller.id)
        .maybeSingle();

      const profileUpdates: Record<string, any> = {
        admin_id: caller.id,
        is_frozen: adminProfile?.is_frozen ?? false,
      };
      if (phone) profileUpdates.phone = phone.replace(/\D/g, "");
      await supabaseAdmin.from("profiles").update(profileUpdates).eq("user_id", newUser.user.id);

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      if (!barber_user_id) {
        return new Response(JSON.stringify({ error: "barber_user_id é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (barber_user_id === caller.id) {
        return new Response(JSON.stringify({ error: "Você não pode remover a si mesmo" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabaseAdmin.from("user_roles").delete().eq("user_id", barber_user_id);
      await supabaseAdmin.auth.admin.deleteUser(barber_user_id);

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "list") {
      // Get admin's own profile + barbers under this admin
      const { data: adminProfile } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name, phone, is_available, avatar_url")
        .eq("user_id", caller.id)
        .maybeSingle();

      const { data: teamProfiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name, phone, is_available, avatar_url")
        .eq("admin_id", caller.id);

      const allProfiles = [
        ...(adminProfile ? [adminProfile] : []),
        ...(teamProfiles || []).filter((p: any) => p.user_id !== caller.id),
      ];

      const barbers = [];
      for (const profile of allProfiles) {
        const { data: { user: u } } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
        barbers.push({
          user_id: profile.user_id,
          full_name: profile.full_name || "",
          phone: profile.phone || "",
          email: u?.email || "",
          is_available: profile.is_available ?? true,
          avatar_url: profile.avatar_url || "",
        });
      }

      return new Response(JSON.stringify({ barbers }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "stats") {
      if (!barber_user_id) {
        return new Response(JSON.stringify({ error: "barber_user_id é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: appointments } = await supabaseAdmin
        .from("appointments")
        .select("client_id, price, status, payment_status, appointment_date, start_time, service_id")
        .eq("barber_id", barber_user_id);

      const all = appointments || [];
      const completed = all.filter((a: any) => a.status === "completed" || a.status === "scheduled");
      const totalClients = new Set(completed.map((a: any) => a.client_id)).size;
      const totalAppointments = completed.length;
      const totalRevenue = completed.filter((a: any) => a.payment_status === "paid").reduce((sum: number, a: any) => sum + Number(a.price || 0), 0);

      // Period-based earnings
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      // Week bounds (Monday-based)
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - mondayOffset);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const weekStartStr = weekStart.toISOString().split("T")[0];
      const weekEndStr = weekEnd.toISOString().split("T")[0];

      const prevWeekStart = new Date(weekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      const prevWeekEnd = new Date(prevWeekStart);
      prevWeekEnd.setDate(prevWeekStart.getDate() + 6);
      const prevWeekStartStr = prevWeekStart.toISOString().split("T")[0];
      const prevWeekEndStr = prevWeekEnd.toISOString().split("T")[0];

      // Month bounds
      const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const monthEndStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
      
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthStartStr = prevMonth.toISOString().split("T")[0];
      const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      const prevMonthEndStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDayPrevMonth).padStart(2, '0')}`;

      const paidCompleted = all.filter((a: any) => a.payment_status === "paid");
      const sumByRange = (data: any[], start: string, end: string) =>
        data.filter(a => a.appointment_date >= start && a.appointment_date <= end).reduce((s, a) => s + Number(a.price || 0), 0);
      const sumByDate = (data: any[], date: string) =>
        data.filter(a => a.appointment_date === date).reduce((s, a) => s + Number(a.price || 0), 0);

      const earnings = {
        today: sumByDate(paidCompleted, todayStr),
        prevDay: sumByDate(paidCompleted, yesterdayStr),
        week: sumByRange(paidCompleted, weekStartStr, weekEndStr),
        prevWeek: sumByRange(paidCompleted, prevWeekStartStr, prevWeekEndStr),
        month: sumByRange(paidCompleted, monthStartStr, monthEndStr),
        prevMonth: sumByRange(paidCompleted, prevMonthStartStr, prevMonthEndStr),
      };

      // Revenue per client
      const clientMap: Record<string, { count: number; revenue: number }> = {};
      for (const a of completed) {
        if (!clientMap[a.client_id]) clientMap[a.client_id] = { count: 0, revenue: 0 };
        clientMap[a.client_id].count++;
        if (a.payment_status === "paid") clientMap[a.client_id].revenue += Number(a.price || 0);
      }

      // Upcoming
      const upcoming = all
        .filter((a: any) => a.status === "scheduled" && a.appointment_date >= todayStr)
        .sort((a: any, b: any) => a.appointment_date.localeCompare(b.appointment_date) || a.start_time.localeCompare(b.start_time));

      const allClientIds = [...new Set([...Object.keys(clientMap), ...upcoming.map((a: any) => a.client_id)])];
      const allServiceIds = [...new Set(upcoming.map((a: any) => a.service_id).filter(Boolean))];

      let profilesMap: Record<string, string> = {};
      let servicesMap: Record<string, string> = {};

      if (allClientIds.length > 0) {
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", allClientIds);
        for (const p of (profiles || [])) profilesMap[p.user_id] = p.full_name || "Cliente";
      }
      if (allServiceIds.length > 0) {
        const { data: services } = await supabaseAdmin
          .from("services")
          .select("id, name")
          .in("id", allServiceIds);
        for (const s of (services || [])) servicesMap[s.id] = s.name;
      }

      const clientDetails = Object.keys(clientMap).map((cid) => ({
        client_id: cid,
        name: profilesMap[cid] || "Cliente",
        appointments: clientMap[cid].count,
        revenue: clientMap[cid].revenue,
      }));

      const upcomingDetails = upcoming.map((a: any) => ({
        appointment_date: a.appointment_date,
        start_time: a.start_time,
        client_name: profilesMap[a.client_id] || "Cliente",
        service_name: servicesMap[a.service_id] || "Serviço",
        price: Number(a.price || 0),
      }));

      return new Response(JSON.stringify({ totalClients, totalAppointments, totalRevenue, earnings, clients: clientDetails, upcoming: upcomingDetails }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "earnings_summary") {
      // Get all barbers under this admin + self
      const { data: selfProfile } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name")
        .eq("user_id", caller.id)
        .maybeSingle();

      const { data: myBarbers } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name")
        .eq("admin_id", caller.id);

      const allBarbers = [
        ...(selfProfile ? [{ user_id: selfProfile.user_id, full_name: selfProfile.full_name }] : []),
        ...(myBarbers || []).filter((b: any) => b.user_id !== caller.id),
      ];

      if (allBarbers.length === 0) {
        return new Response(JSON.stringify({ earnings: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - mondayOffset);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const weekStartStr = weekStart.toISOString().split("T")[0];
      const weekEndStr = weekEnd.toISOString().split("T")[0];

      const prevWeekStart = new Date(weekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);
      const prevWeekEnd = new Date(prevWeekStart);
      prevWeekEnd.setDate(prevWeekStart.getDate() + 6);
      const prevWeekStartStr = prevWeekStart.toISOString().split("T")[0];
      const prevWeekEndStr = prevWeekEnd.toISOString().split("T")[0];

      const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const monthEndStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthStartStr = prevMonth.toISOString().split("T")[0];
      const lastDayPrev = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      const prevMonthEndStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDayPrev).padStart(2, '0')}`;

      const ids = allBarbers.map(b => b.user_id);

      // Fetch all paid appointments for all periods
      const { data: allAppts } = await supabaseAdmin
        .from("appointments")
        .select("price, barber_id, appointment_date")
        .in("barber_id", ids)
        .eq("payment_status", "paid");

      const appts = allAppts || [];

      const sumByBarberRange = (bid: string, start: string, end: string) =>
        appts.filter(a => a.barber_id === bid && a.appointment_date >= start && a.appointment_date <= end)
          .reduce((s, a) => s + Number(a.price || 0), 0);

      const sumByBarberDate = (bid: string, date: string) =>
        appts.filter(a => a.barber_id === bid && a.appointment_date === date)
          .reduce((s, a) => s + Number(a.price || 0), 0);

      const earnings = allBarbers.map(b => ({
        barber_id: b.user_id,
        barber_name: b.full_name || "Barbeiro",
        today: sumByBarberDate(b.user_id, todayStr),
        prevDay: sumByBarberDate(b.user_id, yesterdayStr),
        week: sumByBarberRange(b.user_id, weekStartStr, weekEndStr),
        prevWeek: sumByBarberRange(b.user_id, prevWeekStartStr, prevWeekEndStr),
        month: sumByBarberRange(b.user_id, monthStartStr, monthEndStr),
        prevMonth: sumByBarberRange(b.user_id, prevMonthStartStr, prevMonthEndStr),
      }));

      return new Response(JSON.stringify({ earnings }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "toggle_availability") {
      if (!barber_user_id || typeof is_available !== "boolean") {
        return new Response(JSON.stringify({ error: "barber_user_id e is_available são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await supabaseAdmin.from("profiles").update({ is_available }).eq("user_id", barber_user_id);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "rename") {
      if (!barber_user_id || !full_name) {
        return new Response(JSON.stringify({ error: "barber_user_id e full_name são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await supabaseAdmin.from("profiles").update({ full_name }).eq("user_id", barber_user_id);
      await supabaseAdmin.auth.admin.updateUserById(barber_user_id, { user_metadata: { full_name } });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update_credentials") {
      if (!barber_user_id) {
        return new Response(JSON.stringify({ error: "barber_user_id é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const updates: Record<string, any> = {};
      if (email) updates.email = email;
      if (password) updates.password = password;
      if (full_name) {
        updates.user_metadata = { full_name };
        await supabaseAdmin.from("profiles").update({ full_name }).eq("user_id", barber_user_id);
      }
      if (Object.keys(updates).length === 0) {
        return new Response(JSON.stringify({ error: "Nenhum dado para atualizar" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(barber_user_id, updates);
      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});