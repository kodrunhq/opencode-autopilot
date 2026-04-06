export function escapeAppleScriptText(input: string): string {
	return input.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
}

export function escapePowerShellSingleQuotedText(input: string): string {
	return input.replaceAll("'", "''");
}

export function buildWindowsToastScript(title: string, message: string): string {
	const escapedTitle = escapePowerShellSingleQuotedText(title);
	const escapedMessage = escapePowerShellSingleQuotedText(message);

	return [
		"[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null",
		"[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null",
		'$toastXml = @"',
		"<toast>",
		"  <visual>",
		'    <binding template="ToastGeneric">',
		"      <text></text>",
		"      <text></text>",
		"    </binding>",
		"  </visual>",
		"</toast>",
		'"@',
		"$xml = [Windows.Data.Xml.Dom.XmlDocument]::new()",
		"$xml.LoadXml($toastXml)",
		"$nodes = $xml.GetElementsByTagName('text')",
		`$nodes.Item(0).InnerText = '${escapedTitle}'`,
		`$nodes.Item(1).InnerText = '${escapedMessage}'`,
		"$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)",
		"$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('OpenCode Autopilot')",
		"$notifier.Show($toast)",
	].join("\n");
}
