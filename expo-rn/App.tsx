import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from '@expo-google-fonts/instrument-sans';
import type { RootStackParamList } from './navigation/types';
import { TripScreen } from './navigation/TripTabs';
import { TripHeaderRight, TripHeaderTitle } from './navigation/TripHeader';
import { HomeScreen } from './screens/home/HomeScreen';
import { SettingsScreen } from './screens/settings/SettingsScreen';
import { OfflineBanner } from './components/OfflineBanner';
import { GlassBar } from './components/ui/glass';
import { DataSourceDot } from './components/DataSourceDot';
import { colors, font } from './lib/theme';
import { initPhotoCache } from './lib/offlineStore';
import { authClient, getWasSignedIn, setWasSignedIn } from './lib/auth';
import { WRITE_KEY } from './lib/api/client';
import { LoginScreen } from './screens/auth/LoginScreen';

// Photo-cache index loads once per app launch (photoUrl checks it synchronously).
void initPhotoCache();

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [fontsLoaded] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  });
  const { data: session, isPending } = authClient.useSession();
  // Offline grace: a previously signed-in device skips the gate when the
  // session can't be revalidated (no network) and runs on the offline cache.
  const [offlineGrace, setOfflineGrace] = useState<boolean | null>(null);
  useEffect(() => {
    void (async () => {
      const [was, net] = await Promise.all([getWasSignedIn(), NetInfo.fetch()]);
      setOfflineGrace(was && net.isConnected === false);
    })();
  }, []);
  useEffect(() => {
    if (session) void setWasSignedIn(true);
  }, [session]);

  // Cream splash field while fonts load (Atlas splash recipe).
  if (!fontsLoaded || isPending || offlineGrace === null)
    return <View style={{ flex: 1, backgroundColor: colors.cream }} />;
  // WRITE_KEY = dev-only machine key (expo-web debugging): API calls
  // authenticate via x-api-key, so the session gate is skipped too.
  if (!session && !offlineGrace && !WRITE_KEY) {
    return (
      <SafeAreaProvider>
        <LoginScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      {/* Global offline strip (web OfflineBanner, mounted app-wide in layout.tsx). */}
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <OfflineBanner />
        <NavigationContainer>
          <StatusBar style="dark" />
          <Stack.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: colors.bg },
              headerShadowVisible: false,
              headerTintColor: colors.ink,
              headerTitleStyle: { fontFamily: font.bold, fontSize: 17 },
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen
              name="Home"
              component={HomeScreen}
              // The big logo header is drawn inside the screen (web parity) —
              // the cramped native nav bar made it look off. title kept for
              // the iOS back label on Trip/Settings.
              options={{ headerShown: false, title: 'BurgerGo' }}
            />
            <Stack.Screen
              name="Trip"
              component={TripScreen}
              options={({ route, navigation }) => ({
                title: route.params.name,
                // Glass top chrome (liquid-glass handoff): transparent native bar
                // over a GlassBar plate; screens pad themselves via useHeaderHeight.
                headerTransparent: true,
                headerBackground: () => <GlassBar style={StyleSheet.absoluteFill} />,
                // Web TripHeader: tappable trip name (opens RenameSheet) over a
                // "Sep 4 – Sep 12" caption; Sparkles chip opens the AI import.
                headerTitle: () => (
                  <TripHeaderTitle
                    tripId={route.params.tripId}
                    name={route.params.name}
                    startDate={route.params.startDate}
                    endDate={route.params.endDate}
                    // Route params are the trip-name source of truth (no shell refetch).
                    onRenamed={(name) => navigation.setParams({ name })}
                  />
                ),
                headerRight: () => <TripHeaderRight tripId={route.params.tripId} />,
              })}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                title: 'Settings',
                headerTransparent: true,
                headerBackground: () => <GlassBar style={StyleSheet.absoluteFill} />,
              }}
            />
          </Stack.Navigator>
        </NavigationContainer>
        <DataSourceDot />
      </View>
    </SafeAreaProvider>
  );
}
