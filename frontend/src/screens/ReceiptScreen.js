// Shared receipt page (used by both the customer and the admin routes).
import { Share } from 'react-native';
import { Button, ReceiptView, Screen, receiptText } from '../components';
import { useApp } from '../context/AppContext';

export default function ReceiptScreen({ order }) {
  const { state, showToast } = useApp();

  const share = async () => {
    try {
      await Share.share({ title: `Receipt ${order.receiptNo}`, message: receiptText(order, state.store) });
    } catch {
      showToast('Sharing is not available on this device', 'error');
    }
  };

  return (
    <Screen footer={<Button title="Share Receipt" icon="share-variant-outline" onPress={share} />}>
      <ReceiptView order={order} />
    </Screen>
  );
}
