import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getBlockedUsers, unblockUser, AuthUser } from "@/lib/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const BlockedUsersPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [blockedUsers, setBlockedUsers] = useState<AuthUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnblocking, setIsUnblocking] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AuthUser | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  useEffect(() => {
    loadBlockedUsers();
  }, []);

  const loadBlockedUsers = async () => {
    setIsLoading(true);
    try {
      const users = await getBlockedUsers();
      setBlockedUsers(users);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load blocked users",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnblockClick = (user: AuthUser) => {
    setSelectedUser(user);
    setIsAlertOpen(true);
  };

  const handleConfirmUnblock = async () => {
    if (!selectedUser) return;

    setIsUnblocking(true);
    try {
      await unblockUser(selectedUser.id);
      setBlockedUsers(blockedUsers.filter(u => u.id !== selectedUser.id));
      toast({
        title: "User Unblocked",
        description: `You have unblocked ${selectedUser.displayName || selectedUser.username}.`,
      });
      setIsAlertOpen(false);
      setSelectedUser(null);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to unblock user",
        variant: "destructive",
      });
    } finally {
      setIsUnblocking(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Blocked Users</h1>
        </div>

        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle>Manage Blocked Users</CardTitle>
            <CardDescription>
              Users you have blocked won't be able to message you or see your profile
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : blockedUsers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">You haven't blocked any users</p>
                <Button
                  onClick={() => navigate("/chat")}
                  className="bg-[#00A4EF] hover:bg-[#007BB5] text-white"
                >
                  Back to Chat
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {blockedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 bg-secondary/30 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatarUrl} />
                        <AvatarFallback>{user.displayName?.[0] || user.username[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.displayName || user.username}</p>
                        <p className="text-xs text-muted-foreground">@{user.username}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleUnblockClick(user)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={isUnblocking}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Unblock Confirmation Dialog */}
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unblock User?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedUser && (
                <>
                  You are about to unblock <strong>{selectedUser.displayName || selectedUser.username}</strong>. They will be able to message you and view your profile again.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel disabled={isUnblocking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUnblock}
              disabled={isUnblocking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isUnblocking ? "Unblocking..." : "Unblock"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BlockedUsersPage;
