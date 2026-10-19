import { useLocalSearchParams } from 'expo-router';
import { useApp } from '../../../context/AppContext';
import { EmptyState } from '../../../components';
import ReceiptScreen from '../../../screens/ReceiptScreen';

export default function CustomerReceipt() {
  const { id } = useLocalSearchParams();
  const { state } = useApp();
  const order = state.orders.find((o) => o.id === id);
  if (!order) return <EmptyState title="Receipt not found" />;
  return <ReceiptScreen order={order} />;
}
