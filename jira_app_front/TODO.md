# Task: Restore statistics.component interface + fix SignalR chat signatures

## Plan
- [x] Analyze files and understand data availability
- [x] Rewrite `statistics.component.html` with full statistics interface (header, error, loading, 4 summary cards, 2 charts)
- [x] Rewrite `statistics.component.ts` to fetch stats via AdminService.getStats() and render amCharts 5 pie charts
- [x] Fix `chat.service.ts` SignalR signatures to match backend ChatHub.cs:
  - [x] sendTyping → StartTyping/StopTyping
  - [x] UserTyping listener → UserTypingStatus (conversationId, userId, isTyping)
  - [x] UserOnline listener → UserPresenceChanged
  - [x] MarkedAsRead listener → MessagesRead
  - [x] sendMessage → SendMessage(conversationId, content, attachmentUrl)
  - [x] markAsRead → MarkAsRead(conversationId, messageId)
  - [x] handleIncomingMessage → normalize backend ChatMessageDto (content/sentAt)
- [x] Verify Angular build compiles (success)
</content>
