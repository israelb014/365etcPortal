import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useArchiveClient, useClientDetail, useUpdateClient } from '../../../../lib/hooks';
import { useCanMutate } from '../../../../lib/online';
import { Button } from '../../../../ui/Button';
import { ConfirmDialog } from '../../../../ui/Dialog';
import { TextField } from '../../../../ui/fields';
import { Header } from '../../../../ui/Header';
import { Screen } from '../../../../ui/Screen';
import { colors, space, type } from '../../../../ui/theme';

export default function EditClient() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clientId = Number(id);
  const detail = useClientDetail(clientId);
  const update = useUpdateClient(clientId);
  const archive = useArchiveClient(clientId);
  const canMutate = useCanMutate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(false);
  const client = detail.data?.client;

  useEffect(() => {
    if (!client) return;
    setName(client.name);
    setPhone(client.phone ?? '');
    setNote(client.note ?? '');
  }, [client]);

  return (
    <Screen>
      <Header title="עריכת לקוח" fallback={`/client/${clientId}`} />
      {!client ? (
        <Text style={type.label}>טוען…</Text>
      ) : (
        <>
          <TextField label="שם" value={name} onChangeText={setName} maxLength={120} />
          <TextField
            label="טלפון"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={40}
            style={{ writingDirection: 'ltr', textAlign: 'right' }}
          />
          <TextField label="הערה" value={note} onChangeText={setNote} multiline maxLength={2000} />
          {update.isError ? <Text style={[type.label, { color: colors.unpaid }]}>{update.error.message}</Text> : null}
          <Button
            title="שמור"
            big
            disabled={!canMutate || !name.trim()}
            loading={update.isPending}
            onPress={() =>
              update.mutate(
                { name: name.trim(), phone: phone.trim() || null, note: note.trim() || null },
                { onSuccess: () => router.back() },
              )
            }
          />
          <Button
            title="העבר לארכיון"
            icon="archive"
            variant="danger"
            disabled={!canMutate}
            onPress={() => setConfirm(true)}
            style={{ marginTop: space.xl }}
          />
          <ConfirmDialog
            visible={confirm}
            title={`להעביר את ${client.name} לארכיון?`}
            text="הלקוח וכל השירותים שלו יוסתרו ולא יישלחו עליהם תזכורות."
            confirm="העבר לארכיון"
            busy={archive.isPending}
            onCancel={() => setConfirm(false)}
            onConfirm={() =>
              archive.mutate(undefined, {
                onSuccess: () => {
                  setConfirm(false);
                  router.replace('/');
                },
              })
            }
          />
        </>
      )}
    </Screen>
  );
}
