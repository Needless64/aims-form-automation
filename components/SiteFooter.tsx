import Image from "next/image";
import { INSTITUTION } from "@/lib/institution";

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div className="footer__brand">
            <Image
              src="/images/aims-emblem.png"
              alt=""
              width={90}
              height={79}
              unoptimized
            />
            <div>
              <strong>Arundathi Institute of Medical Sciences</strong>
              <address>{INSTITUTION.address}</address>
            </div>
          </div>

          <div className="footer__contact">
            <a href={`tel:${INSTITUTION.phoneHref}`}>
              Admissions · {INSTITUTION.phone}
            </a>
            <a href={`mailto:${INSTITUTION.admissionsEmail}`}>
              {INSTITUTION.admissionsEmail}
            </a>
            <a
              href={INSTITUTION.maps}
              target="_blank"
              rel="noopener noreferrer"
            >
              Locate on Google Maps ↗
            </a>
            <a
              href={INSTITUTION.website}
              target="_blank"
              rel="noopener noreferrer"
            >
              Official website ↗
            </a>
            <a
              href={INSTITUTION.virtualTour}
              target="_blank"
              rel="noopener noreferrer"
            >
              Virtual campus tour ↗
            </a>
            <a
              href={INSTITUTION.linkedin}
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn ↗
            </a>
          </div>
        </div>

        <div className="footer__bottom">
          <span>
            © {new Date().getFullYear()} Arundathi Institute of Medical
            Sciences. All rights reserved.
          </span>
          <span>
            Counselling code{" "}
            <span className="footer__code">{INSTITUTION.counsellingCode}</span>{" "}
            · Admissions {INSTITUTION.academicYear}
          </span>
        </div>
      </div>
    </footer>
  );
}
