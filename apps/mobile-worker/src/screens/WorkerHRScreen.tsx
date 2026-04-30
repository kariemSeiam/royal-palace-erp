import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getWorkerHrOverview } from "../features/hr/api";

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor:"rgba(255,255,255,0.06)", borderRadius:24, padding:20, borderWidth:1, borderColor:"rgba(212,175,55,0.15)", marginBottom:16 }}>
      <Text style={{ color:"#D4AF37", fontWeight:"800", fontSize:20, marginBottom:12, textAlign:"center", writingDirection:"rtl" }}>{title}</Text>
      {children}
    </View>
  );
}

const infoStyle = { color:"#CBD5E1", textAlign:"center" as const, marginBottom:6, fontSize:15, lineHeight:22, writingDirection:"rtl" as const };

export default function WorkerHRScreen() {
  const q = useQuery({ queryKey:["worker-hr-overview"], queryFn:getWorkerHrOverview, retry:false });
  if (q.isLoading) return <SafeAreaView edges={["left","right"]} style={{ flex:1, backgroundColor:"#0B1F3A" }}><View style={{ flex:1, alignItems:"center", justifyContent:"center" }}><ActivityIndicator size="large" color="#D4AF37" /><Text style={{ marginTop:12, color:"#FFFFFF", fontWeight:"700", writingDirection:"rtl" }}>جارٍ تحميل بيانات الشؤون...</Text></View></SafeAreaView>;
  const data = q.data;
  return (
    <SafeAreaView edges={["left","right"]} style={{ flex:1, backgroundColor:"#0B1F3A" }}>
      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:120 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} colors={["#D4AF37"]} tintColor="#D4AF37" />}
      >
        <Text style={{ color:"#FFFFFF", fontSize:26, fontWeight:"800", marginBottom:20, textAlign:"center", writingDirection:"rtl" }}>💼 شؤوني وراتبي</Text>
        <SectionCard title="💰 بيانات الراتب">
          <Text style={infoStyle}>الراتب الأساسي: {Number(data?.compensation.basic_salary||0).toFixed(2)} ج.م</Text>
          <Text style={infoStyle}>بدل السكن: {Number(data?.compensation.housing_allowance||0).toFixed(2)} ج.م</Text>
          <Text style={infoStyle}>بدل الانتقال: {Number(data?.compensation.transport_allowance||0).toFixed(2)} ج.م</Text>
          <Text style={infoStyle}>بدل الوجبات: {Number(data?.compensation.meal_allowance||0).toFixed(2)} ج.م</Text>
        </SectionCard>
        <SectionCard title="🕒 الحضور والانضباط">
          <Text style={infoStyle}>ساعات العمل الفعلية: {Math.floor((Number(data?.attendance_summary?.worked_minutes)||0)/60)} ساعة</Text>
          <Text style={infoStyle}>إجمالي التأخير: {Number(data?.attendance_summary?.late_minutes||0)} دقيقة</Text>
          <Text style={infoStyle}>إجمالي الإضافي: {Number(data?.attendance_summary?.overtime_minutes||0)} دقيقة</Text>
        </SectionCard>
        <SectionCard title="🏖️ الإجازات">
          {!data?.leaves?.length ? <Text style={infoStyle}>لا توجد طلبات إجازة حالية.</Text> : data.leaves.map((x:any)=><Text key={x.id} style={infoStyle}>{x.leave_type} — {x.start_date} إلى {x.end_date} ({x.days_count||x.total_days} يوم)</Text>)}
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}
