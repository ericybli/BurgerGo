/**
 * Per-trip bottom-tab navigator: Plan · Eats · Tickets · Budget · To do ·
 * Journal — mirroring the web app's BottomTabBar (Atlas Light: lucide icons,
 * faint inactive / accent active, white bar over a hairline). Trip identity
 * flows via TripProvider.
 */
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Book, CreditCard, MapPin, SquareCheck, Ticket, Utensils } from 'lucide-react-native';
import type { RootStackParamList, TripTabParamList } from './types';
import { TripProvider } from './TripContext';
import { colors, font } from '../lib/theme';
import { PlanScreen } from '../screens/plan/PlanScreen';
import { EatsScreen } from '../screens/eats/EatsScreen';
import { TicketsScreen } from '../screens/tickets/TicketsScreen';
import { BudgetScreen } from '../screens/budget/BudgetScreen';
import { TodoScreen } from '../screens/todo/TodoScreen';
import { JournalScreen } from '../screens/journal/JournalScreen';

const Tab = createBottomTabNavigator<TripTabParamList>();

type IconCmp = typeof MapPin;

function tabIcon(Icon: IconCmp) {
  // Web BottomTabBar: size 21 / stroke 2 in BOTH states — active is color-only.
  return ({ focused }: { focused: boolean; color: string; size: number }) => (
    <Icon size={21} color={focused ? colors.accent : colors.faint} strokeWidth={2} />
  );
}

export function TripScreen({ route }: NativeStackScreenProps<RootStackParamList, 'Trip'>) {
  const insets = useSafeAreaInsets();
  return (
    <TripProvider trip={route.params}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.faint,
          tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 10 },
          tabBarStyle: {
            backgroundColor: colors.bg,
            borderTopColor: colors.line,
            borderTopWidth: 1,
            height: 60 + insets.bottom,
            paddingTop: 8,
            paddingBottom: insets.bottom + 6,
          },
        }}
      >
        <Tab.Screen name="Plan" component={PlanScreen} options={{ tabBarLabel: 'Plan', tabBarIcon: tabIcon(MapPin) }} />
        <Tab.Screen name="Eats" component={EatsScreen} options={{ tabBarLabel: 'Eats', tabBarIcon: tabIcon(Utensils) }} />
        <Tab.Screen name="Tickets" component={TicketsScreen} options={{ tabBarLabel: 'Tickets', tabBarIcon: tabIcon(Ticket) }} />
        <Tab.Screen name="Budget" component={BudgetScreen} options={{ tabBarLabel: 'Budget', tabBarIcon: tabIcon(CreditCard) }} />
        <Tab.Screen name="Todo" component={TodoScreen} options={{ tabBarLabel: 'To do', tabBarIcon: tabIcon(SquareCheck) }} />
        <Tab.Screen name="Journal" component={JournalScreen} options={{ tabBarLabel: 'Journal', tabBarIcon: tabIcon(Book) }} />
      </Tab.Navigator>
    </TripProvider>
  );
}
