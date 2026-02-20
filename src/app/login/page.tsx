import { Github } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { signIn } from '@/lib/auth'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Welcome to Juanie</h1>
          <p className="text-muted-foreground mt-2">Sign in to your account to continue</p>
        </div>

        <div className="space-y-4">
          <form
            action={async () => {
              'use server'
              await signIn('github', { redirectTo: '/' })
            }}
          >
            <Button type="submit" className="w-full" size="lg">
              <Github className="mr-2 h-5 w-5" />
              Sign in with GitHub
            </Button>
          </form>

          <form
            action={async () => {
              'use server'
              await signIn('gitlab', { redirectTo: '/' })
            }}
          >
            <Button type="submit" className="w-full" size="lg" variant="outline">
              Sign in with GitLab
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
