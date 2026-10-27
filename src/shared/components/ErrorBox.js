import { FeedbackBox } from './FeedbackBox';

// RN-SPEC-v2-foundation §5: ErrorBox is the error FeedbackBox (danger-text
// tint, icon, bold title + muted message). The title stays optional, as in v1.
export default function ErrorBox({ title, message, testID }) {
  return <FeedbackBox tone="error" title={title} message={message} testID={testID} accessibilityRole="alert" />;
}
