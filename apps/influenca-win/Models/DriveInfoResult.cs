namespace Influenca.Win.Models;

public sealed record DriveInfoResult(string Name, string DriveType, long AvailableFreeSpace, long TotalSize);
