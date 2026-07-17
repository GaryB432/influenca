using Influenca.Win.Models;

namespace Influenca.Win.Commands;

public static class DriveCommand
{
    public static void Run()
    {
        var drives = DriveInfo.GetDrives()
            .Where(d => d.IsReady)
            .Select(d => new DriveInfoResult(d.Name, d.DriveType.ToString(), d.AvailableFreeSpace, d.TotalSize));

        foreach (var drive in drives)
        {
            Console.WriteLine($"{drive.Name} {drive.DriveType} {drive.AvailableFreeSpace}/{drive.TotalSize}");
        }
    }
}
