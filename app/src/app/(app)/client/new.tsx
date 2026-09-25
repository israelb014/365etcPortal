import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { useCreateClient } from '../../../lib/hooks';
import { useCanMutate } from '../../../lib/online';
import { Button } from '../../../ui/Button';
import { TextField } from '../../../ui/fields';
import { Header } from '../../../ui/Header';
import { Screen } from '../../../ui/Screen';
import { colors, type } from '../../../ui/theme';

/** Add client: just a name, then straight to "add service". */
export default function NewClient() {
  const [name, setName] = useState('');
  const create = useCreateClient();
  const canMutate = useCanMutate();
  const save = () => {
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim() },
      { onSuccess: (c) => router.replace(`/service/new?clientId=${c.id}&fresh=1`) },
    );
  };
  return (
    <Screen>
      <Header title="לקוח חדש" />
      <TextField
        label="שם הלקוח"
        value={name}
        onChangeText={setName}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={save}
        maxLength={120}
      />
      {create.isError ? <Text style={[type.label, { color: colors.unpaid }]}>{create.error.message}</Text> : null}
      <Button title="שמור" big onPress={save} loading={create.isPending} disabled={!name.trim() || !canMutate} />
    </Screen>
  );
}
