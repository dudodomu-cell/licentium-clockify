import { getCurrentProfile } from "@/lib/auth";
import { fetchProfiles } from "@/lib/db";
import { ProfileForm } from "@/components/profile-form";
import { TeamRates } from "@/components/team-rates";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = await getCurrentProfile();
  const profiles = profile.is_admin ? await fetchProfiles() : [];

  return (
    <main>
      <div className="hero">
        <h1>Profile</h1>
        <p>
          Your name and default hourly rate. The rate is the suggested $/hr
          for new entries &mdash; you can still override it per row when
          adding manual entries or editing.
        </p>
      </div>

      <section>
        <div className="section-head">
          <div className="section-num">
            <b>01 /</b> You
          </div>
        </div>
        <ProfileForm profile={profile} />
      </section>

      {profile.is_admin && (
        <section>
          <div className="section-head">
            <div className="section-num">
              <b>02 /</b> Team rates
            </div>
            <div className="section-num mute">admin only</div>
          </div>
          <TeamRates
            profiles={profiles}
            currentUserId={profile.id}
          />
        </section>
      )}
    </main>
  );
}
