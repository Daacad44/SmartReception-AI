import { useParams } from 'react-router-dom';
import { AITrainingPage } from './AITrainingPage';

export function AdminAITrainingDetail() {
  const { businessId } = useParams<{ businessId: string }>();
  return <AITrainingPage businessId={businessId} />;
}
