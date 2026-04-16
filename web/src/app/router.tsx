import { createBrowserRouter } from "react-router-dom";
import { HomeRoute } from "@/routes/HomeRoute";
import { HazardPuzzleRoute } from "@/routes/HazardPuzzleRoute";
import { TrafficControlRoute } from "@/routes/TrafficControlRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <HomeRoute />
  },
  {
    path: "/hazard-puzzle",
    element: <HazardPuzzleRoute />
  },
  {
    path: "/traffic-control",
    element: <TrafficControlRoute />
  }
]);

