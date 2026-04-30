import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { workerLogout } from "../features/auth/api";
import { getWorkerProfile } from "../features/profile/api";

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection:"row-reverse", justifyContent:"space-between", paddingVertical:10, borderBottomWidth:1, borderBottomColor:"rgba(212,175,55,0.15)" }}>
      <Text style={{ color:"#FFFFFF", fontWeight:"600", textAlign:"center", writingDirection:"rtl" }}>{value||"-"}</Text>
      <Text style={{ color:"#CBD5E1", textAlign:"center", writingDirection:"rtl" }}>{label}</Text>
    </View>
  );
}

export default function WorkerProfileScreen({ navigation }: any) {
  const q = useQuery({ queryKey:["worker-profile-screen"], queryFn:getWorkerProfile, retry:false });
  async function handleLogout() { await workerLogout(); navigation.reset({ index:0, routes:[{ name:"WorkerLogin" }] }); }
  if (q.isLoading) return <SafeAreaView edges={["left","right"]} style={{ flex:1, backgroundColor:"#0B1F3A" }}><View style={{ flex:1, alignItems:"center", justifyContent:"center" }}><ActivityIndicator size="large" color="#D4AF37" /><Text style={{ marginTop:12, color:"#FFFFFF", fontWeight:"700", writingDirection:"rtl" }}>جارٍ تحميل الملف الشخصي...</Text></View></SafeAreaView>;
  if (q.error || !q.data?.employee?.id) return <SafeAreaView edges={["left","right"]} style={{ flex:1, backgroundColor:"#0B1F3A" }}><View style={{ flex:1, justifyContent:"center", padding:24 }}><Text style={{ color:"#D4AF37", fontWeight:"700", textAlign:"center", fontSize:18, writingDirection:"rtl" }}>تعذر تحميل الملف الشخصي</Text></View></SafeAreaView>;
  const { user, employee, factory, department } = q.data;
  const fullName = user.full_name || `${employee.first_name||""} ${employee.last_name||""}`.trim() || "العامل";
  return (
    <SafeAreaView edges={["left","right"]} style={{ flex:1, backgroundColor:"#0B1F3A" }}>
      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:120 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} colors={["#D4AF37"]} tintColor="#D4AF37" />}
      >
        <View style={{ backgroundColor:"rgba(255,255,255,0.06)", borderRadius:30, padding:24, borderWidth:1, borderColor:"rgba(212,175,55,0.15)", marginBottom:20, alignItems:"center" }}>
          <Text style={{ fontSize:64, marginBottom:12 }}>👤</Text>
          <Text style={{ color:"#FFFFFF", fontWeight:"800", fontSize:24, textAlign:"center", marginBottom:8, writingDirection:"rtl" }}>{fullName}</Text>
          <Text style={{ color:"#D4AF37", fontWeight:"700", textAlign:"center", writingDirection:"rtl" }}>{employee.job_title||"موظف"}</Text>
        </View>
        <View style={{ backgroundColor:"rgba(255,255,255,0.06)", borderRadius:24, padding:20, borderWidth:1, borderColor:"rgba(212,175,55,0.15)", marginBottom:20 }}>
          <Text style={{ color:"#D4AF37", fontWeight:"800", fontSize:20, marginBottom:16, textAlign:"center", writingDirection:"rtl" }}>بيانات العامل</Text>
          <ProfileRow label="الاسم" value={fullName} />
          <ProfileRow label="اسم المستخدم" value={user.username||"-"} />
          <ProfileRow label="رقم الموظف" value={employee.employee_code||String(employee.id)} />
          <ProfileRow label="الوظيفة" value={employee.job_title||"-"} />
          <ProfileRow label="القسم" value={department?.name||`#${employee.department_id}`||"-"} />
          <ProfileRow label="المصنع" value={factory?.name||`#${employee.factory_id}`||"-"} />
          <ProfileRow label="تاريخ التعيين" value={employee.hire_date?new Date(employee.hire_date).toLocaleDateString("ar-EG"):"-"} />
          <ProfileRow label="الهاتف" value={user.phone||employee.phone||"-"} />
          <ProfileRow label="البريد" value={user.email||employee.email||"-"} />
        </View>
        <Pressable onPress={handleLogout} style={{ backgroundColor:"rgba(254,226,226,0.12)", borderRadius:99, paddingVertical:16, alignItems:"center", borderWidth:1, borderColor:"rgba(185,28,28,0.4)" }}>
          <Text style={{ color:"#EF4444", fontWeight:"800", fontSize:16, writingDirection:"rtl" }}>🚪 تسجيل الخروج</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
