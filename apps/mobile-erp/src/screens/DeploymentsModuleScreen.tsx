import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { erpColors } from "../theme/tokens";

export default function DeploymentsModuleScreen() {
  return (
    <SafeAreaView edges={["left", "right"]} style={{ flex: 1, backgroundColor: erpColors.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <View style={hero}>
          <Text style={heroTop}>DEPLOYMENTS</Text>
          <Text style={heroTitle}>النشرات</Text>
          <Text style={heroBody}>
            هذه الوحدة موجودة في admin-web كمرحلة أولية، لذلك تم عكسها على الموبايل كلوحة حالة وتجهيز.
          </Text>
        </View>

        <View style={[box, { marginBottom: 12 }]}>
          <Text style={boxTitle}>الحالة الحالية</Text>
          <Text style={boxBody}>
            وحدة النشرات موجودة بالفعل داخل الإدارة، لكن الراوتر الخلفي المخصص لها غير منفصل حاليًا،
            لذلك شاشة الموبايل في هذه المرحلة تعرض حالة التجهيز فقط بدون عمليات تنفيذية.
          </Text>
        </View>

        <View style={box}>
          <Text style={boxTitle}>المستهدف لاحقًا</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            <Bullet text="سجل النشرات والإصدارات" />
            <Bullet text="حالة البيئة والخدمات قبل وبعد النشر" />
            <Bullet text="سجل زمني للتحديثات والتنفيذ" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={bulletRow}>
      <Text style={bulletDot}>•</Text>
      <Text style={bulletText}>{text}</Text>
    </View>
  );
}

const hero = { backgroundColor: erpColors.navy2, borderRadius: 28, padding: 20, marginBottom: 12 };
const heroTop = { color: erpColors.gold, fontWeight: "800" as const, textAlign: "right" as const };
const heroTitle = { marginTop: 8, color: "#fff", fontSize: 28, fontWeight: "800" as const, textAlign: "right" as const };
const heroBody = { marginTop: 10, color: "rgba(255,255,255,0.78)", lineHeight: 24, textAlign: "right" as const };
const box = { backgroundColor: "#ffffff", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: erpColors.border };
const boxTitle = { color: erpColors.text, fontWeight: "800" as const, fontSize: 20, textAlign: "right" as const };
const boxBody = { marginTop: 10, color: erpColors.textMuted, lineHeight: 24, textAlign: "right" as const };
const bulletRow = { flexDirection: "row-reverse" as const, alignItems: "flex-start" as const, gap: 8 };
const bulletDot = { color: erpColors.gold, fontWeight: "800" as const };
const bulletText = { flex: 1, color: erpColors.textMuted, lineHeight: 24, textAlign: "right" as const };
