import { useSeoMeta } from '@unhead/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CommentsSection } from '@/components/comments/CommentsSection';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageCircle, Users, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ThreadDemo = () => {
  const navigate = useNavigate();

  useSeoMeta({
    title: 'Thread Demo - Universes',
    description: 'Demonstration of Discord-like threaded comments with in-chat previews.',
  });

  // Create a mock discussion post URL for demo
  const demoPostUrl = new URL('https://example.com/discussion/introducing-new-threading');

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="mb-4 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Chat
          </Button>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Discord-Style Threading Demo
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Experience our improved threading system with in-chat previews and Discord-like interactions
          </p>
        </div>

        {/* Demo Post */}
        <Card className="mb-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl text-gray-900 dark:text-gray-100">
                  📣 Introducing Enhanced Thread Previews
                </CardTitle>
                <div className="flex items-center space-x-3 mt-2">
                  <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    Announcement
                  </Badge>
                  <div className="flex items-center space-x-1 text-sm text-gray-500">
                    <Users className="w-4 h-4" />
                    <span>Community Team</span>
                  </div>
                  <div className="flex items-center space-x-1 text-sm text-gray-500">
                    <Calendar className="w-4 h-4" />
                    <span>Just now</span>
                  </div>
                </div>
              </div>
              <MessageCircle className="w-6 h-6 text-gray-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose dark:prose-invert max-w-none">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                We're excited to introduce our new <strong>Discord-style thread preview system</strong>!
                This enhancement brings a more familiar and intuitive way to engage with threaded conversations.
              </p>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                🎉 What's New:
              </h3>

              <ul className="space-y-2 text-gray-700 dark:text-gray-300">
                <li><strong>In-chat Thread Previews:</strong> See thread activity without leaving the main conversation</li>
                <li><strong>Avatar Stack Display:</strong> Quickly identify who's participating in each thread</li>
                <li><strong>Smart Reply Previews:</strong> Get a quick glimpse of the latest activity</li>
                <li><strong>One-Click Thread Access:</strong> Expand threads inline for deeper engagement</li>
                <li><strong>Discord-Familiar UX:</strong> Interactions that feel natural and intuitive</li>
              </ul>

              <p className="text-gray-700 dark:text-gray-300 mt-4">
                Try it out by commenting below and see how replies create beautiful,
                Discord-style thread previews that make conversations more organized and engaging!
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Comments Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <CommentsSection
            root={demoPostUrl}
            title="💬 Discussion & Feedback"
            emptyStateMessage="Start the conversation!"
            emptyStateSubtitle="Share your thoughts about the new threading system"
            className="border-0 shadow-none bg-transparent"
          />
        </div>

        {/* Feature Highlights */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                  Smart Thread Previews
                </h3>
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-200">
                See who's in each thread and get a preview of the latest reply without expanding the full conversation.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-800">
            <CardContent className="p-6">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-green-900 dark:text-green-100">
                  Discord-Familiar UX
                </h3>
              </div>
              <p className="text-sm text-green-700 dark:text-green-200">
                Interactions that feel natural with hover effects, inline replies, and familiar visual patterns.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ThreadDemo;
