import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { useArchiveService, useClientDetail, useSaveService } from '../../../../lib/hooks';
import { useCanMutate } from '../../../../lib/online';
import { Button } from '../../../../ui/Button';
import { ConfirmDialog } from '../../../../ui/Dialog';
import { Header } from '../../../../ui/Header';
import { Screen } from '../../../../ui/Screen';
import { ServiceForm } from '../../../../ui/ServiceForm';
import { colors, space, type } from '../../../../ui/theme';

export default function EditService() {
  const { id, clientId: rawClient } = useLocalSearchParams<{ id: string; clientId: string }>();
  const serviceId = Number(id);
  const clientId = Number(rawClient);
  const detail = useClientDetail(clientId);
  const service = detail.data?.services.find((s) => s.id === serviceId);
  const save = useSaveService(serviceId);
  const archive = useArchiveService(serviceId, clientId);
  const canMutate = useCanMutate();
  const [confirm, setConfirm] = useState(false);

  return (
    <Screen>
      <Header title="עריכת שירות" fallback={`/client/${clientId}`} />
      {!service ? (
        <Text style={type.label}>{detail.isPending ? 'טוען…' : 'השירות לא נמצא'}</Text>
      ) : (
        <>
          {service.source === 'microsoft' ? (
            <Text style={[type.small, { marginBottom: space.lg, color: colors.pending }]}>
              השירות מתעדכן אוטומטית ממיקרוסופט (תאריך החידוש והרישיון)
            </Text>
          ) : null}
          <ServiceForm
            clientId={clientId}
            initial={service}
            saving={save.isPending}
            canMutate={canMutate}
            error={save.isError ? save.error.message : null}
            onSave={({ client_id: _c, ...body }) => save.mutate(body, { onSuccess: () => router.back() })}
          />
          <Button
            title="העבר לארכיון"
            icon="archive"
            variant="danger"
            onPress={() => setConfirm(true)}
            disabled={!canMutate}
            style={{ marginTop: space.xl }}
          />
          <ConfirmDialog
            visible={confirm}
            title="להעביר את השירות לארכיון?"
            text="השירות לא יופיע יותר ברשימות ובתזכורות."
            confirm="העבר לארכיון"
            busy={archive.isPending}
            onCancel={() => setConfirm(false)}
            onConfirm={() =>
              archive.mutate(undefined, {
                onSuccess: () => {
                  setConfirm(false);
                  router.back();
                },
              })
            }
          />
        </>
      )}
    </Screen>
  );
}
