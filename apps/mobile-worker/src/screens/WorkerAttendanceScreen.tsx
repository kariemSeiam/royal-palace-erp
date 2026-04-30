import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getWorkerAttendanceHistory, getWorkerAttendanceToday, workerCheckIn, workerCheckOut } from "../features/attendance/api";

const timeLabel = (v?: string|null) => { if(!v) return ""; const d=new Date(v); if(Number.isNaN(d.getTime())) return v; return d.toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit"}); };
const statusEmoji = (s?: string) => { const st=(s||"").toLowerCase(); if(st==="present"||st==="حاضر") return "✅ حاضر"; if(st==="absent"||st==="غائب") return "❌ غائب"; if(st==="late"||st==="متأخر") return "⚠️ متأخر"; if(st==="half_day"||st==="نصف يوم") return "⏳ نصف يوم"; if(st==="paid_leave"||st==="إجازة مدفوعة") return "🏖️ إجازة"; if(st==="unpaid_leave"||st==="إجازة غير مدفوعة") return "🏖️ إجازة"; return "❓ "+(s||"غير معروف"); };

export default function WorkerAttendanceScreen() {
  const qc = useQueryClient();
  const todayQ = useQuery({ queryKey:["worker-attendance-today"], queryFn:getWorkerAttendanceToday, retry:false });
  const historyQ = useQuery({ queryKey:["worker-attendance-history"], queryFn:getWorkerAttendanceHistory, retry:false });
  const checkInM = useMutation({ mutationFn:()=>workerCheckIn(), onSuccess:async()=>{ await qc.invalidateQueries({queryKey:["worker-attendance-today"]}); await qc.invalidateQueries({queryKey:["worker-attendance-history"]}); } });
  const checkOutM = useMutation({ mutationFn:()=>workerCheckOut(), onSuccess:async()=>{ await qc.invalidateQueries({queryKey:["worker-attendance-today"]}); await qc.invalidateQueries({queryKey:["worker-attendance-history"]}); } });
  const today = todayQ.data;
  const history = Array.isArray(historyQ.data)?historyQ.data:[];
  const canCheckIn = Boolean(today&&!today.check_in_at);
  const canCheckOut = Boolean(today&&today.check_in_at&&!today.check_out_at);
  const refreshAll = ()=>{ todayQ.refetch(); historyQ.refetch(); };

  return (
    <SafeAreaView edges={["left","right"]} style={{ flex:1, backgroundColor:"#0B1F3A" }}>
      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:120 }} refreshControl={<RefreshControl refreshing={todayQ.isFetching||historyQ.isFetching} onRefresh={refreshAll} colors={["#D4AF37"]} tintColor="#D4AF37" />} showsVerticalScrollIndicator={false}>
        <Text style={{ color:"#FFFFFF", fontSize:26, fontWeight:"800", marginBottom:20, textAlign:"center", writingDirection:"rtl" }}>🕒 الحضور والانصراف</Text>
        <View style={{ backgroundColor:"rgba(255,255,255,0.08)", borderRadius:28, padding:24, marginBottom:20, borderWidth:1, borderColor:"rgba(212,175,55,0.2)" }}>
          {todayQ.isLoading ? <ActivityIndicator size="large" color="#D4AF37" /> : todayQ.isError ? <Text style={{ color:"#D4AF37", textAlign:"center", fontSize:18, writingDirection:"rtl" }}>خطأ في تحميل الحضور</Text> : (
            <>
              <Text style={{ fontSize:48, textAlign:"center", marginBottom:12 }}>🪪</Text>
              <Text style={{ fontSize:22, fontWeight:"800", color:"#FFFFFF", textAlign:"center", marginBottom:8, writingDirection:"rtl" }}>{today?.check_in_at?"حضرت اليوم":"لم تحضر بعد"}</Text>
              {today?.check_in_at && <Text style={{ color:"#CBD5E1", textAlign:"center", marginBottom:6, fontSize:16, writingDirection:"rtl" }}>{timeLabel(today.check_in_at)}</Text>}
              {today?.check_out_at && <Text style={{ color:"#CBD5E1", textAlign:"center", marginBottom:6, fontSize:16, writingDirection:"rtl" }}>انصرفت: {timeLabel(today.check_out_at)}</Text>}
              {today?.status && <Text style={{ fontSize:20, textAlign:"center", marginVertical:8, color: today.status==="present"?"#4ADE80":"#FBBF24", fontWeight:"700", writingDirection:"rtl" }}>{statusEmoji(today.status)}</Text>}
              <View style={{ marginTop:24 }}>
                {canCheckIn && <Pressable onPress={()=>checkInM.mutate()} disabled={checkInM.isPending} style={{ backgroundColor:"#D4AF37", borderRadius:99, paddingVertical:18, alignItems:"center", justifyContent:"center", marginBottom: canCheckOut?12:0, opacity: checkInM.isPending?0.6:1 }}>{checkInM.isPending?<ActivityIndicator color="#0B1F3A" />:<Text style={{ color:"#0B1F3A", fontWeight:"800", fontSize:20, writingDirection:"rtl" }}>✅ تسجيل حضور</Text>}</Pressable>}
                {canCheckOut && <Pressable onPress={()=>checkOutM.mutate()} disabled={checkOutM.isPending} style={{ backgroundColor:"rgba(255,255,255,0.10)", borderWidth:2, borderColor:"#D4AF37", borderRadius:99, paddingVertical:18, alignItems:"center", justifyContent:"center", opacity: checkOutM.isPending?0.6:1 }}>{checkOutM.isPending?<ActivityIndicator color="#D4AF37" />:<Text style={{ color:"#FFFFFF", fontWeight:"800", fontSize:20, writingDirection:"rtl" }}>🚪 تسجيل انصراف</Text>}</Pressable>}
                {!canCheckIn && !canCheckOut && today?.check_out_at && <Text style={{ textAlign:"center", color:"#4ADE80", fontWeight:"700", fontSize:18, writingDirection:"rtl" }}>✅ تم تسجيل الحضور والانصراف اليوم</Text>}
              </View>
            </>
          )}
        </View>
        <Text style={{ color:"#FFFFFF", fontSize:22, fontWeight:"800", marginBottom:12, textAlign:"center", writingDirection:"rtl" }}>📋 آخر الأيام</Text>
        {historyQ.isLoading ? <ActivityIndicator size="small" color="#D4AF37" /> : historyQ.isError ? <Text style={{ color:"#D4AF37", textAlign:"center", writingDirection:"rtl" }}>تعذر تحميل السجل</Text> : history.length===0 ? <Text style={{ textAlign:"center", color:"#CBD5E1", writingDirection:"rtl" }}>لا يوجد سجل</Text> : history.map((item:any)=>(<View key={item.id} style={{ backgroundColor:"rgba(255,255,255,0.06)", borderRadius:18, padding:16, marginBottom:10, flexDirection:"row", justifyContent:"space-between", alignItems:"center", borderWidth:1, borderColor:"rgba(212,175,55,0.15)" }}><View><Text style={{ color:"#FFFFFF", fontWeight:"700", writingDirection:"rtl" }}>{statusEmoji(item.status)}</Text><Text style={{ color:"#CBD5E1", marginTop:2, writingDirection:"rtl" }}>{new Date(item.attendance_date).toLocaleDateString("ar-EG")}</Text></View><View style={{ alignItems:"flex-end" }}><Text style={{ color:"#FFFFFF", writingDirection:"rtl" }}>{timeLabel(item.check_in_at)} - {timeLabel(item.check_out_at)}</Text></View></View>))}
      </ScrollView>
    </SafeAreaView>
  );
}
