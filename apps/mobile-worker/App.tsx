import "react-native-gesture-handler";
import { I18nManager, Text, View } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";

import BootstrapScreen from "./src/screens/BootstrapScreen";
import LoginScreen from "./src/screens/LoginScreen";
import WorkerHomeScreen from "./src/screens/WorkerHomeScreen";
import WorkerAttendanceScreen from "./src/screens/WorkerAttendanceScreen";
import WorkerWorkOrdersScreen from "./src/screens/WorkerWorkOrdersScreen";
import WorkerHRScreen from "./src/screens/WorkerHRScreen";
import WorkerProfileScreen from "./src/screens/WorkerProfileScreen";

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const queryClient = new QueryClient();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "#0B1F3A",
    card: "#0B1F3A",
    text: "#FFFFFF",
    border: "rgba(212,175,55,0.18)",
    primary: "#D4AF37",
  },
};

function HeaderBrandTitle() {
  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 14, fontWeight: "800", color: "#FFFFFF" }}>ROYAL PALACE</Text>
      <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.76)", letterSpacing: 1 }}>WORKER APP</Text>
    </View>
  );
}

function baseStackOptions() {
  return {
    title: undefined,
    headerTitle: () => <HeaderBrandTitle />,
    headerTitleAlign: "center" as const,
    headerShadowVisible: false,
    headerStyle: { backgroundColor: "#0B1F3A" },
    headerTintColor: "#D4AF37",
    headerBackTitleVisible: false,
    contentStyle: { backgroundColor: "#0B1F3A" },
    animation: I18nManager.isRTL ? ("slide_from_right" as const) : ("slide_from_left" as const),
  };
}

function HomeStack() {
  const Stack = createNativeStackNavigator();
  return <Stack.Navigator screenOptions={baseStackOptions()}><Stack.Screen name="WorkerHomeMain" component={WorkerHomeScreen} options={baseStackOptions()} /></Stack.Navigator>;
}
function AttendanceStack() {
  const Stack = createNativeStackNavigator();
  return <Stack.Navigator screenOptions={baseStackOptions()}><Stack.Screen name="WorkerAttendanceMain" component={WorkerAttendanceScreen} options={baseStackOptions()} /></Stack.Navigator>;
}
function WorkOrdersStack() {
  const Stack = createNativeStackNavigator();
  return <Stack.Navigator screenOptions={baseStackOptions()}><Stack.Screen name="WorkerWorkOrdersMain" component={WorkerWorkOrdersScreen} options={baseStackOptions()} /></Stack.Navigator>;
}
function HrStack() {
  const Stack = createNativeStackNavigator();
  return <Stack.Navigator screenOptions={baseStackOptions()}><Stack.Screen name="WorkerHrMain" component={WorkerHRScreen} options={baseStackOptions()} /></Stack.Navigator>;
}
function ProfileStack() {
  const Stack = createNativeStackNavigator();
  return <Stack.Navigator screenOptions={baseStackOptions()}><Stack.Screen name="WorkerProfileMain" component={WorkerProfileScreen} options={baseStackOptions()} /></Stack.Navigator>;
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      backBehavior="history"
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: 78 + Math.max(insets.bottom, 8),
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 8),
          borderTopWidth: 1,
          borderTopColor: "rgba(212,175,55,0.18)",
          backgroundColor: "#0B1F3A",
        },
        tabBarActiveTintColor: "#D4AF37",
        tabBarInactiveTintColor: "rgba(255,255,255,0.76)",
        tabBarLabelStyle: { fontSize: 12, fontWeight: "800" },
        tabBarItemStyle: { borderRadius: 16, marginHorizontal: 4, marginVertical: 4 },
        tabBarActiveBackgroundColor: "rgba(212,175,55,0.25)",
      }}
    >
      <Tab.Screen name="WorkerHomeTab" component={HomeStack} options={{ tabBarLabel: "الرئيسية", tabBarIcon: ({focused}) => <Ionicons name="home-outline" size={26} color={focused?"#D4AF37":"rgba(255,255,255,0.76)"} /> }} />
      <Tab.Screen name="WorkerAttendanceTab" component={AttendanceStack} options={{ tabBarLabel: "الحضور", tabBarIcon: ({focused}) => <Ionicons name="time-outline" size={26} color={focused?"#D4AF37":"rgba(255,255,255,0.76)"} /> }} />
      <Tab.Screen name="WorkerWorkOrdersTab" component={WorkOrdersStack} options={{ tabBarLabel: "التشغيل", tabBarIcon: ({focused}) => <MaterialCommunityIcons name="clipboard-text-outline" size={28} color={focused?"#D4AF37":"rgba(255,255,255,0.76)"} /> }} />
      <Tab.Screen name="WorkerHrTab" component={HrStack} options={{ tabBarLabel: "شؤوني", tabBarIcon: ({focused}) => <MaterialCommunityIcons name="wallet-outline" size={28} color={focused?"#D4AF37":"rgba(255,255,255,0.76)"} /> }} />
      <Tab.Screen name="WorkerProfileTab" component={ProfileStack} options={{ tabBarLabel: "ملفي", tabBarIcon: ({focused}) => <Ionicons name="person-outline" size={26} color={focused?"#D4AF37":"rgba(255,255,255,0.76)"} /> }} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer theme={navTheme}>
          <RootStack.Navigator initialRouteName="Bootstrap">
            <RootStack.Screen name="Bootstrap" component={BootstrapScreen} options={{ headerShown: false }} />
            <RootStack.Screen name="WorkerLogin" component={LoginScreen} options={{ headerShown: false }} />
            <RootStack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
          </RootStack.Navigator>
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
