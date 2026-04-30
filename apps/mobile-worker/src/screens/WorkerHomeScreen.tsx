import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getWorkerProfile } from "../features/profile/api";

function ValueCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 20, padding: 18, borderWidth: 1, borderColor: "rgba(212,175,55,0.18)", alignItems: "center", marginBottom: 12 }}>
      <Text style={{ fontSize: 32, marginBottom: 8 }}>{icon}</Text>
      <Text style={{ color: "#CBD5E1", fontWeight: "600", textAlign: "center", marginBottom: 4, fontSize: 14, writingDirection: "rtl" }}>{label}</Text>
      <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 18, textAlign: "center", writingDirection: "rtl" }}>{value}</Text>
    </View>
  );
}

export default function WorkerHomeScreen() {
  const q = useQuery({ queryKey: ["worker-profile-home"], queryFn: getWorkerProfile, retry: false });

  if (q.isLoading) return (
    <SafeAreaView edges={["left","right"]} style={{ flex:1, backgroundColor:"#0B1F3A" }}>
      <View style={{ flex:1, alignItems:"center", justifyContent:"center" }}>
        <ActivityIndicator size="large" color="#D4AF37" />
        <Text style={{ marginTop:16, color:"#FFFFFF", fontWeight:"700", writingDirection:"rtl" }}>جارٍ تحميل البيانات...</Text>
      </View>
    </SafeAreaView>
  );

  if (q.error || !q.data?.employee?.id) return (
    <SafeAreaView edges={["left","right"]} style={{ flex:1, backgroundColor:"#0B1F3A" }}>
      <View style={{ flex:1, justifyContent:"center", padding:24 }}>
        <Text style={{ color:"#D4AF37", fontWeight:"700", textAlign:"center", fontSize:18, writingDirection:"rtl" }}>تعذر تحميل البيانات</Text>
      </View>
    </SafeAreaView>
  );

  const { employee, user, factory, department } = q.data;
  const fullName = user.full_name || `${employee.first_name||""} ${employee.last_name||""}`.trim() || "العامل";
  const factoryName = factory?.name || `مصنع #${employee.factory_id}`;
  const departmentName = department?.name || `قسم #${employee.department_id}`;
  const jobTitle = employee.job_title || "-";

  return (
    <SafeAreaView edges={["left","right"]} style={{ flex:1, backgroundColor:"#0B1F3A" }}>
      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:120 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} colors={["#D4AF37"]} tintColor="#D4AF37" />}
      >
        <View style={{ backgroundColor:"rgba(255,255,255,0.06)", borderRadius:30, padding:24, borderWidth:1, borderColor:"rgba(212,175,55,0.15)", marginBottom:20, alignItems:"center" }}>
          <Text style={{ fontSize:64, marginBottom:12 }}>🏭</Text>
          <Text style={{ color:"#FFFFFF", fontWeight:"800", fontSize:28, textAlign:"center", marginBottom:8, writingDirection:"rtl" }}>مرحباً، {fullName}</Text>
          <Text style={{ color:"#D4AF37", fontWeight:"800", fontSize:18, textAlign:"center", marginBottom:4, writingDirection:"rtl" }}>{jobTitle}</Text>
          <Text style={{ color:"rgba(255,255,255,0.72)", textAlign:"center", lineHeight:24, writingDirection:"rtl" }}>{factoryName} — {departmentName}</Text>
        </View>
        <View style={{ flexDirection:"row-reverse", gap:12, flexWrap:"wrap" }}>
          <ValueCard icon="🏭" label="المصنع" value={factoryName} />
          <ValueCard icon="🏢" label="القسم" value={departmentName} />
        </View>
        <View style={{ flexDirection:"row-reverse", gap:12, flexWrap:"wrap" }}>
          <ValueCard icon="💼" label="الوظيفة" value={jobTitle} />
          <ValueCard icon="🪪" label="رقم الموظف" value={employee.employee_code || String(employee.id)} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
