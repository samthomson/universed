import { useSeoMeta } from '@unhead/react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { LoginArea } from '@/components/auth/LoginArea';
import { EditProfileForm } from '@/components/EditProfileForm';
import { nip19 } from 'nostr-tools';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const EditProfile = () => {
  const { npub } = useParams<{ npub: string }>();
  const { user } = useCurrentUser();
  const navigate = useNavigate();

  let pubkey: string | null = null;
  let error: string | null = null;

  // Decode npub to get pubkey
  if (npub) {
    try {
      if (npub.startsWith('npub1')) {
        const decoded = nip19.decode(npub);
        if (decoded.type === 'npub') {
          pubkey = decoded.data;
        } else {
          error = 'Invalid npub format';
        }
      } else {
        error = 'Invalid npub format';
      }
    } catch {
      error = 'Invalid npub format';
    }
  } else {
    error = 'No npub provided';
  }

  useSeoMeta({
    title: 'Edit Profile - Universes',
    description: 'Edit your profile on Universes.',
  });

  // Check if user is logged in and editing their own profile
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto text-center space-y-8 p-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
              Edit Profile
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Log in to edit your profile on Universes
            </p>
          </div>

          <div className="flex justify-center">
            <LoginArea className="max-w-60" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !pubkey) {
    return (
      <div className="min-h-screen bg-gray-800 text-gray-100">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <h1 className="text-2xl font-bold text-white">Profile Not Found</h1>
            <p className="text-gray-400">{error || 'Invalid profile URL'}</p>
          </div>
        </div>
      </div>
    );
  }

  // Check if user is editing their own profile
  if (user.pubkey !== pubkey) {
    return (
      <div className="min-h-screen bg-gray-800 text-gray-100">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <h1 className="text-2xl font-bold text-white">Access Denied</h1>
            <p className="text-gray-400">You can only edit your own profile.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-800 text-gray-100">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header with back button */}
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/profile/${npub}`)}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Profile
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-white">Edit Profile</CardTitle>
              <p className="text-gray-400">
                Update your profile information and settings
              </p>
            </CardHeader>
            <CardContent>
              <EditProfileForm />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EditProfile;
