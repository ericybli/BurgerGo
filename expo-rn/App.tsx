import { Pressable, View } from 'react-native';
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
import { Settings as SettingsIcon } from 'lucide-react-native';
import type { RootStackParamList } from './navigation/types';
import { TripScreen } from './navigation/TripTabs';
import { TripHeaderRight, TripHeaderTitle } from './navigation/TripHeader';
import { HomeScreen } from './screens/home/HomeScreen';
import { SettingsScreen } from './screens/settings/SettingsScreen';
import { OfflineBanner } from './components/OfflineBanner';
import { colors, font } from './lib/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [fontsLoaded] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
  });
  // Cream splash field while fonts load (Atlas splash recipe).
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.cream }} />;

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
              options={({ navigation }) => ({
                title: 'BurgerGo',
                headerRight: () => (
                  // Web (home)/layout.tsx: 36px round surface chip, Settings 18 ink, active scale 0.95.
                  <Pressable
                    onPress={() => navigation.navigate('Settings')}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Settings"
                    style={({ pressed }) => [
                      {
                        width: 36,
                        height: 36,
                        borderRadius: 999,
                        backgroundColor: colors.surface,
                        alignItems: 'center',
                        justifyContent: 'center',
                      },
                      pressed && { transform: [{ scale: 0.95 }] },
                    ]}
                  >
                    <SettingsIcon size={18} color={colors.ink} />
                  </Pressable>
                ),
              })}
            />
            <Stack.Screen
              name="Trip"
              component={TripScreen}
              options={({ route, navigation }) => ({
                title: route.params.name,
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
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </View>
    </SafeAreaProvider>
  );
}
