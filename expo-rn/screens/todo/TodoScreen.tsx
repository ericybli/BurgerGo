import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { SegmentedControl } from '../../components/ui';
import { colors } from '../../lib/theme';
import { PackingView } from './PackingView';
import { TasksView } from './TasksView';

type Sub = 'packing' | 'tasks';

export function TodoScreen() {
  const [sub, setSub] = useState<Sub>('packing');
  // Transparent glass stack header (Task 5) — scroll content starts below it.
  const headerHeight = useHeaderHeight();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      // Top padding clears the transparent glass stack header; bottom padding
      // clears the floating glass tab bar (content scrolls under both).
      contentContainerStyle={{ padding: 16, paddingTop: headerHeight + 16, paddingBottom: 150 }}
      keyboardShouldPersistTaps="handled"
      // iOS: lift the focused add-item/add-task input above the keyboard
      // (Android resizes the window itself; no-op on web).
      automaticallyAdjustKeyboardInsets
    >
      <SegmentedControl
        options={[
          { value: 'packing', label: 'Packing list' },
          { value: 'tasks', label: 'Tasks' },
        ]}
        value={sub}
        onChange={setSub}
      />
      <View style={{ height: 16 }} />
      {sub === 'packing' ? <PackingView /> : <TasksView />}
    </ScrollView>
  );
}
