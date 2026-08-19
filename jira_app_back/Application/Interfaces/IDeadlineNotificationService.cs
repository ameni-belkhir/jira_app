using System.Threading.Tasks;

namespace Application.Interfaces
{
    public interface IDeadlineNotificationService
    {
        Task CheckAndSendDeadlineNotificationsAsync();
    }
}
