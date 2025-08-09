import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { WatchlistToggle } from "@/components/watchlist-toggle";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="px-3 py-1">
              TickrTime
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <WatchlistToggle count={0} isActive={false} onClick={() => {}} />
            <ThemeToggle />
          </div>
        </header>

        {/* Main Content */}
        <main>
          <div className="mb-8">
            <h1 className="mb-4 text-foreground font-bold text-4xl">
              TickrTime, never miss earnings again
            </h1>
            <p className="text-muted-foreground mb-6">
              A modern earnings tracking dashboard for technology stocks. 
              Real-time data from 2,246+ tech companies.
            </p>
          </div>

          {/* Status Card */}
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-green-600 dark:text-green-400">
                ✅ Setup Complete
              </CardTitle>
              <CardDescription>
                All components and infrastructure are ready
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <h4 className="font-medium mb-2">✅ Completed</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Git repository & project structure</li>
                    <li>• TypeScript & Next.js 15 setup</li>
                    <li>• API routes with real data</li>
                    <li>• shadcn/ui components</li>
                    <li>• Core hooks & utilities</li>
                    <li>• Theme system</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">🚧 Next Steps</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Build EarningsTable component</li>
                    <li>• Connect real API data</li>
                    <li>• Implement search & filtering</li>
                    <li>• Add navigation buttons</li>
                    <li>• Polish UI interactions</li>
                  </ul>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Test the theme toggle and watchlist components above. 
                  Ready to continue with the main dashboard.
                </p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
