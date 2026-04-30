import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { workerLogin } from "../features/auth/api";

type Props = { navigation: any };

export default function LoginScreen({ navigation }: Props) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const passwordRef = useRef<TextInput | null>(null);
  const trimmedPhone = phone.trim();
  const trimmedPassword = password.trim();
  const canSubmit = Boolean(trimmedPhone && trimmedPassword.length >= 4);

  const mutation = useMutation({
    mutationFn: workerLogin,
    onSuccess: () => { navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] }); },
  });

  function submitLogin() {
    if (!canSubmit || mutation.isPending) return;
    mutation.mutate({ identifier: trimmedPhone, password: trimmedPassword });
  }

  return (
    <SafeAreaView edges={["left", "right"]} style={{ flex: 1, backgroundColor: "#0B1F3A" }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView contentContainerStyle={{ padding: 32, flexGrow: 1, justifyContent: "center" }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={{ alignItems: "center", marginBottom: 36 }}>
            <Text style={{ fontSize: 64 }}>🏭</Text>
            <Text style={{ color: "#D4AF37", fontSize: 16, fontWeight: "700", letterSpacing: 2, textAlign:"center", writingDirection: "rtl" }}>ROYAL PALACE</Text>
          </View>
          <Text style={{ color: "#FFFFFF", fontSize: 20, marginBottom: 12, textAlign:"center", fontWeight: "600", writingDirection: "rtl" }}>📱 رقم الهاتف</Text>
          <TextInput value={phone} onChangeText={setPhone} placeholder="01xxxxxxxxx" placeholderTextColor="#94A3B8" keyboardType="phone-pad" textAlign="right" style={{ backgroundColor: "#FFFFFF", borderRadius: 24, paddingHorizontal: 24, paddingVertical: 18, fontSize: 20, color: "#0F172A", textAlign:"center", marginBottom: 24, borderWidth: 1, borderColor: "rgba(212,175,55,0.25)", writingDirection: "rtl" }} onSubmitEditing={() => passwordRef.current?.focus()} blurOnSubmit={false} />
          <Text style={{ color: "#FFFFFF", fontSize: 20, marginBottom: 12, textAlign:"center", fontWeight: "600", writingDirection: "rtl" }}>🔒 الرمز السري</Text>
          <TextInput ref={passwordRef} value={password} onChangeText={setPassword} placeholder="****" placeholderTextColor="#94A3B8" secureTextEntry textAlign="right" returnKeyType="done" style={{ backgroundColor: "#FFFFFF", borderRadius: 24, paddingHorizontal: 24, paddingVertical: 18, fontSize: 20, color: "#0F172A", textAlign:"center", marginBottom: 32, borderWidth: 1, borderColor: "rgba(212,175,55,0.25)", writingDirection: "rtl" }} onSubmitEditing={submitLogin} />
          {mutation.isError && (
            <View style={{ backgroundColor: "#FEF2F2", borderRadius: 20, padding: 16, marginBottom: 20 }}>
              <Text style={{ color: "#B91C1C", fontWeight: "600", textAlign: "center", fontSize: 16, writingDirection: "rtl" }}>{mutation.error instanceof Error ? mutation.error.message : "خطأ في تسجيل الدخول"}</Text>
            </View>
          )}
          <Pressable onPress={submitLogin} disabled={!canSubmit || mutation.isPending} style={[{ backgroundColor: "#D4AF37", borderRadius: 99, paddingVertical: 20, alignItems: "center" }, (!canSubmit || mutation.isPending) && { opacity: 0.5 }]}>
            {mutation.isPending ? <ActivityIndicator color="#0B1F3A" /> : <Text style={{ color: "#0B1F3A", fontWeight: "800", fontSize: 22, writingDirection: "rtl" }}>دخول</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
