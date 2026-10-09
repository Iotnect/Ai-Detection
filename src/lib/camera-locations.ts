// Client sources: MBS Camera location.xlsx, rows 61–67, cross-checked against
// MBS_Camera_Location_SHP.zip. WGS84; source SHP points are longitude, latitude.
export const cameraLocations = [
  { code: "MBS-KDN-C1", location: "Sungai Taman Ros Merah", latitude: 2.801309, longitude: 101.792278 },
  { code: "MBS-KDN-C2", location: "Hadapan Big Farmasi", latitude: 2.801682, longitude: 101.794634 },
  { code: "MBS-KDN-C3", location: "Hadapan Petron Pekan Nilai", latitude: 2.801724, longitude: 101.797484 },
  { code: "MBS-KDN-C4", location: "Hadapan Econsave Stesen Bas Nilai", latitude: 2.801960, longitude: 101.798357 },
  { code: "MBS-KDN-C5", location: "Hadapan Klinik Kesihatan Nilai", latitude: 2.803019, longitude: 101.798637 },
  { code: "MBS-KDN-C6", location: "Hadapan KTM Nilai", latitude: 2.801939, longitude: 101.799162 },
  { code: "MBS-KDN-C7", location: "Simpang Tiga Taman Nilai Perdana", latitude: 2.806154, longitude: 101.801624 },
] as const;

export type MapCameraCode = (typeof cameraLocations)[number]["code"];
