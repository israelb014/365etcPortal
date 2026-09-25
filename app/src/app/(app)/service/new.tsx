import { router, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { useSaveService, useSnapshot } from '../../../lib/hooks';
import { useCanMutate } from '../../../lib/online';
import { Header } from '../../../ui/Header';
import { Screen } from '../../../ui/Screen';
import { ServiceForm } from '../../../ui/ServiceForm';
import { type } from '../../../ui/theme';

export default function NewService() {
  const { clientId: raw, fresh } = useLocalSearchParams<{ clientId: string; fresh?: string }>();
  const clientId = Number(raw);
  const save = useSaveService();
  const canMutate = useCanMutate();
  const client = useSnapshot().data?.clients.find((c) => c.id === clientId);
  return (
    <Screen>
      <Header title="שירות חדש" fallback={`/client/${clientId}`} />
      {client ? <Text style={[type.label, { marginTop: -8, marginBottom: 16 }]}>{client.name}</Text> : null}
      <ServiceForm
        clientId={clientId}
        saving={save.isPending}
        canMutate={canMutate}
        error={save.isError ? save.error.message : null}
        onSave={(body) =>
          save.mutate(body, {
            onSuccess: () =>
              fresh ? router.replace(`/client/${clientId}`) : router.canGoBack() ? router.back() : router.replace(`/client/${clientId}`),
          })
        }
      />
    </Screen>
  );
}
