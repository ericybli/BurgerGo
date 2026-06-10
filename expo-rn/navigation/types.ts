/** Navigation param lists. Root stack hosts Home, the trip tab navigator, and Settings. */
export type RootStackParamList = {
  Home: undefined;
  Trip: { tripId: string; name: string; startDate: string; endDate: string };
  Settings: undefined;
};

export type TripTabParamList = {
  Plan: undefined;
  Eats: undefined;
  Tickets: undefined;
  Budget: undefined;
  Todo: undefined;
  Journal: undefined;
};
