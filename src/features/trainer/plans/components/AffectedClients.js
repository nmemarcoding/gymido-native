import Banner, { BannerText } from '../../../../shared/components/Banner';
import { formatAffectsNotice, formatClientsOnPlan } from '../planFormat';
import { WarningNotice } from './builderParts';

// Spec §B1. Every count UI hides when the count is null (unknown/failed) or 0.
const hasCount = (count) => typeof count === 'number' && count > 0;

// v2 look (phase6 O builder states): the amber card with the info icon,
// a 14/700 title and the 14/22 body; a status region.
export function ClientsBanner({ count }) {
  if (!hasCount(count)) {
    return null;
  }
  return (
    <WarningNotice
      testID="plan-clients-banner"
      title={formatClientsOnPlan(count)}
      body="Your edits reach them from their next workout. Past and in-progress workouts stay as they are."
    />
  );
}

// The notice at the top of the edit modals (UX §0.4): the amber card.
export function AffectsNoticeBox({ count }) {
  if (!hasCount(count)) {
    return null;
  }
  return <WarningNotice testID="affects-notice" body={formatAffectsNotice(count)} />;
}

// The same notice inside the action dialogs (UX §0.4 / PlanActionDialog).
export function AffectsNoticeLine({ count }) {
  return <AffectsNoticeBox count={count} />;
}

// v2 look (§5 Banners): the warning banner, its title in warning with the icon.
export function InactiveBanner({ body }) {
  return (
    <Banner testID="plan-inactive-banner" title="This plan is inactive" warningTitle>
      <BannerText>{body}</BannerText>
    </Banner>
  );
}
