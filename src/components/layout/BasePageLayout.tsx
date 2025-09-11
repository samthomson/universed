import { ReactNode } from "react";
import { UserPanel } from "./UserPanel";

interface BasePageLayoutProps {
	mainContent: ReactNode;
	leftPanel?: ReactNode;
	rightPanel?: ReactNode;
	showUserPanel?: boolean;
}

// Base layout template that all pages can use
export function BasePageLayout({
	mainContent,
	leftPanel,
	rightPanel,
	showUserPanel = true
}: BasePageLayoutProps) {
	return (
		<div className="flex h-full overflow-hidden">
			{/* Left Panel */}
			{leftPanel && (
				<div className="w-72 bg-secondary/30 flex flex-col h-full">
					{leftPanel}
					{showUserPanel && <UserPanel />}
				</div>
			)}

			{/* Main Content Area */}
			<div className="flex-1 flex flex-col min-h-0">
				{mainContent}
			</div>

			{/* Right Panel */}
			{rightPanel && (
				<div className="w-72 bg-secondary/30">
					{rightPanel}
				</div>
			)}
		</div>
	);
}

export default BasePageLayout;
