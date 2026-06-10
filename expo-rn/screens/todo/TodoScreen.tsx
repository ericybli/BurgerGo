import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SegmentedControl } from '../../components/ui';
import { colors } from '../../lib/theme';
import { PackingView } from './PackingView';
import { TasksView } from './TasksView';

type Sub = 'packing' | 'tasks';

export function TodoScreen() {
  const [sub, setSub] = useState<Sub>('packing');
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
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
