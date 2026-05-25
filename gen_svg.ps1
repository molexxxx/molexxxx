$shapes = [ordered]@{
  AWS="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='COLOR'><path d='M7 19a5 5 0 0 1-.9-9.92A6 6 0 0 1 17.5 8.5 4.5 4.5 0 0 1 18 17.5V19z'/></svg>"
  EC2="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='COLOR'><rect x='3' y='5' width='18' height='6' rx='1'/><rect x='3' y='13' width='18' height='6' rx='1'/></svg>"
  RDS="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='COLOR' stroke-width='2'><ellipse cx='12' cy='5' rx='8' ry='2.5'/><path d='M4 5v14c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V5'/><path d='M4 12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5'/></svg>"
  S3="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='COLOR'><path d='M4 6h16l-2 15H6z'/></svg>"
  Route53="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='COLOR' stroke-width='2'><circle cx='12' cy='12' r='9'/><path d='M3 12h18'/><path d='M12 3a14 16 0 0 1 0 18'/><path d='M12 3a14 16 0 0 0 0 18'/></svg>"
  CloudFront="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='COLOR' stroke-width='2' stroke-linecap='round'><circle cx='12' cy='12' r='5'/><path d='M12 2v2M12 20v2M2 12h2M20 12h2M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2'/></svg>"
  CloudWatch="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='COLOR' stroke-width='2' stroke-linecap='round'><circle cx='12' cy='12' r='9'/><path d='M12 7v5l3 3'/></svg>"
  Azure="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='COLOR'><path d='M10 4L3 19h6l2-5zM12 6l-2 5 4 7h8z'/></svg>"
  Akamai="<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='COLOR' stroke-width='2' stroke-linecap='round'><circle cx='12' cy='12' r='9' opacity='0.5'/><path d='M5 14c2.5-4 5-4 7 0s4.5 4 7 0'/></svg>"
}
$lines = foreach ($k in $shapes.Keys) {
  $w = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($shapes[$k].Replace("COLOR","#ffffff")))
  $d = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($shapes[$k].Replace("COLOR","#1f2328")))
  "$k|$w|$d"
}
$lines | Set-Content .\svg_b64.txt -Encoding utf8
Get-Content .\svg_b64.txt
