import Parent from "../models/parent.model.js";

/**
 * Parent Controller
 * Endpoints accessible to logged-in parents.
 */
class ParentController {
  /**
   * Get the logged-in parent's profile
   * @route GET /api/parents/me
   * @access Parent
   */
  async getMe(req, res) {
    try {
      const parentProfileId = req.user?.profileId;
      if (!parentProfileId) {
        return res.status(400).json({
          success: false,
          message: "Parent profileId missing on user",
        });
      }

      const parent = await Parent.findById(parentProfileId)
        .populate("userId", "name email phone status createdAt")
        .populate({
          path: "children",
          select: "userId classId section rollNumber",
          populate: [
            { path: "userId", select: "name email phone status" },
            { path: "classId", select: "name section" },
          ],
        });

      if (!parent) {
        return res.status(404).json({
          success: false,
          message: "Parent profile not found",
        });
      }

      return res.status(200).json({
        success: true,
        data: parent,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error fetching parent profile",
        error: error.message,
      });
    }
  }

  /**
   * Get the logged-in parent's linked children
   * @route GET /api/parents/me/children
   * @access Parent
   */
  async getMyChildren(req, res) {
    try {
      const parentProfileId = req.user?.profileId;
      if (!parentProfileId) {
        return res.status(400).json({
          success: false,
          message: "Parent profileId missing on user",
        });
      }

      const parent = await Parent.findById(parentProfileId).populate({
        path: "children",
        populate: [
          { path: "userId", select: "name email phone status" },
          {
            path: "classId",
            select:
              "name section academicYear subjects classTeacher roomNumber",
            populate: [
              { path: "subjects", select: "name code" },
              {
                path: "classTeacher",
                populate: [{ path: "userId", select: "name email phone" }],
              },
            ],
          },
        ],
      });

      if (!parent) {
        return res.status(404).json({
          success: false,
          message: "Parent profile not found",
        });
      }

      return res.status(200).json({
        success: true,
        count: parent.children?.length || 0,
        data: parent.children || [],
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error fetching children",
        error: error.message,
      });
    }
  }
}

export default new ParentController();
