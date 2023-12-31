import { DocumentContractModel } from "@/models/DocumentContractModel";
import React from "react";
import { FaCheck, FaCalendarMinus, FaCalendarPlus, FaDownload, FaEnvelope, FaExclamation, FaHeading, FaMapMarker, FaPhone, FaTimes, FaTrash } from "react-icons/fa";
import IconCard from "../generic/data-view/IconCard";
import { dateFromTimestamp, formatDate } from "@/utils/DateUtils";
import IconButton from "../generic/buttons/IconButton";
import useAlert from "@/hooks/AlertHook";
import { useRouter } from "next/router";
import { getConnectedAddress } from "@/utils/MetamaskUtils";
import { User } from "@prisma/client";
import { getEvaluateDueDateExtensionText, getRemoveAssessmentProvidersText, getSentMainDocumentText, mailUser } from "../../utils/MailingUtils";
import {MainDocumentType} from "../../models/DocumentContractModel";
import useConformationPopup from "@/hooks/ConformationPopupHook";

interface AssessmentProviderInfoPopupProps {
  documentContract?: DocumentContractModel;
  assessmentProvider: User;
  projectAddress: string;
  projectName: string;
  onClose: () => void;
  isDPPPhaseFinalized: boolean;
  isAdministrativeAuthority?: boolean;
}

const AssessmentProviderInfoPopup = (props: AssessmentProviderInfoPopupProps) => {
  const router = useRouter();
  const { setAlert } = useAlert();
  const { setConformationPopup } = useConformationPopup();

  const handleRemoveAssessmentProvider = async () => {
    setConformationPopup({
      title: "Odstrani mnenjedajalce",
      message: `Ali ste prepričani, da želite odstraniti mnenjedajalca ${props.assessmentProvider.name}`,
      icon: <FaTrash />,
      popupType: "error",
      buttonPrimaryText: "Pošlji",
      onClickPrimary: removeAssessmentProvider,
      show: true,
    });
  };

  const removeAssessmentProvider = async () => {
    const response = await fetch(`/api/projects/removeAssessmentProviders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectAddress: props.projectAddress,
        signerAddress: await getConnectedAddress(window),
        assessmentProvidersAddresses: [props.assessmentProvider.walletAddress],
      }),
    });

    if (response.ok) {
      if (props.documentContract) {
        const responseMail = await mailUser({
          to: [props.assessmentProvider.email],
          subject: `${props.projectName} - Odstranitev iz projekta ${props.projectName}`,
          text: getRemoveAssessmentProvidersText(props.projectName),
        });
        if (!responseMail.ok) setAlert({ title: "", message: (await responseMail.json()).message, type: "error" });
      }
      setAlert({ title: "", message: `Mnenjedajalec ${props.assessmentProvider.name} odstranjen.`, type: "success" });
      router.push(router.asPath);
    } else {
      setAlert({ title: "", message: (await response.json()).message, type: "error" });
    }
    router.push(router.asPath);
  };

  const handleRequestedDueDateExtensionEvaluation = async (confirmed: boolean) => {
    setConformationPopup({
      title: `${confirmed ? "Sprejmi" : "Zavrni"} zahtevo za podaljšanje roka`,
      message: `Ali ste prepričani, da želite ${confirmed ? "sprejeti" : "zavrniti"} zahtevo za podaljšanje roka za ocenitev`,
      icon: confirmed ? <FaCalendarPlus /> : <FaTimes />,
      popupType: confirmed ? "success" : "error",
      buttonPrimaryText: confirmed ? "Sprejmi" : "Zavrni",
      onClickPrimary: async () => {
        try {
          const response = await fetch(`/api/documentContracts/evaluateAssessmentDueDateExtension`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              documentContractAddress: props.documentContract!.documentContractAddress,
              signerAddress: await getConnectedAddress(window),
              confirmed: confirmed,
            }),
          });

          if (response.ok) {
            const responseMail = await mailUser({
              to: [props.assessmentProvider.email],
              subject: `${props.projectName} - zahteva za podaljšanje roka ${confirmed ? "sprejeta" : "zavrnjena"}`,
              text: getEvaluateDueDateExtensionText(props.projectName, confirmed),
              link: router.asPath,
            });
            if (!responseMail.ok) throw new Error(await responseMail.json());
            setAlert({ title: "Uspeh", message: `Zahteva za podaljšanje roka za ocenitev ${confirmed ? "sprejeta" : "zavrnjena"}`, type: "success" });
            router.push(router.asPath);
          } else {
            throw new Error(await response.json());
          }
        } catch (e: any) {
          setAlert({ title: "Napaka", message: e.message.message, type: "error" });
        }
      },
      show: true,
    });
  };

  return (
    <div className="fixed z-50 top-0 left-0 w-full h-full bg-black bg-opacity-50 flex justify-center items-center">
      <span className="fixed top-0 left-0 w-full h-full" onClick={props.onClose}></span>
      <div className="max-w-6xl w-full rounded-lg bg-gray-100 p-4 shadow-lg sm:p-6 lg:p-8 relative">
        <div className="absolute top-5 right-5">
          <FaTimes className="hover:text-gray-500 hover:cursor-pointer" size={20} onClick={props.onClose} />
        </div>
        {props.documentContract && !props.documentContract.isClosed && (
          <>
            <div className="flex justify-between gap-3 mt-10 bg-white px-5 py-3 rounded-lg">
              <h1 className="flex items-center">
                Rok za oddajo mnenja: <span className="ms-2 text-xl font-semibold">{formatDate(dateFromTimestamp(props.documentContract.assessmentDueDate!))}</span>
              </h1>
              <div>
                {props.documentContract.requestedAssessmentDueDate && (
                  <div className="inline-flex items-center gap-3">
                    {(!props.isAdministrativeAuthority) ? (<>
                        <p className="me-1 text-lg text-gray-500 font-semibold">{formatDate(dateFromTimestamp(props.documentContract.requestedAssessmentDueDate))}</p>
                        <IconButton
                          className="text-white bg-green-700 hover:text-green-700 hover:bg-white"
                          text={"Potrdi podaljšanje roka"}
                          icon={<FaCalendarPlus/>}
                          onClick={() => handleRequestedDueDateExtensionEvaluation(true)}
                        />
                        <IconButton
                        className="text-white bg-red-600 hover:text-red-600 hover:bg-white"
                        text={"Zavrni podaljšanje roka"}
                        icon={<FaCalendarMinus />}
                        onClick={() => handleRequestedDueDateExtensionEvaluation(false)}
                        />
                      </>)
                      : (<h1 className="flex items-center text-gray-500">Prošnja za podaljšanje roka do
                          <span className="ms-2 text-xl font-semibold text-gray-500">{formatDate(dateFromTimestamp(props.documentContract.requestedAssessmentDueDate!))}</span>
                        </h1>)}
                  </div>
                )}
              </div>
            </div>
            {props.documentContract.mainDocumentUpdateRequested && (
              <div className="mt-5 inline-flex items-center text-main-200 font-semibold gap-3 border-2 border-main-200 bg-white px-5 py-3 rounded-lg">
                <FaExclamation />
                Zahtevana posodobitev dokumenta
              </div>
            )}
          </>
        )}
        <div className="mt-10">
          <h1 className="text-xl mb-3 font-semibold">Osnovne informacije</h1>
          <IconCard title={"Ime"} value={props.assessmentProvider.name} icon={<FaHeading />} />
          <IconCard title={"Naslov"} value={props.assessmentProvider.streetAddress} icon={<FaMapMarker />} />
          {props.assessmentProvider.phone && <IconCard title={"Telefon"} value={props.assessmentProvider.phone} icon={<FaPhone />} />}
          <IconCard title={"E-pošta"} value={props.assessmentProvider.email} icon={<FaEnvelope />} />
          {(props.documentContract && props.documentContract.isClosed) &&
            (<IconCard
                title={`Datum ${props.documentContract!.mainDocumentType == MainDocumentType.DPP ? "poslanih projektnih pogojev" : "poslanega projektnega mnenja"} 
                (rok do ${formatDate(dateFromTimestamp(props.documentContract!.assessmentDueDate))})`}
              value={formatDate(dateFromTimestamp(props.documentContract!.assessmentDateProvided))}
              icon={(dateFromTimestamp(props.documentContract!.assessmentDateProvided) < dateFromTimestamp(props.documentContract!.assessmentDueDate)) ?
              <FaCheck className="text-green-500"/> : <FaTimes className="text-red-500"/>}
                />
          )}
        </div>
        {(!props.isAdministrativeAuthority) && (<div className="flex justify-end">
          {(!props.documentContract || (props.documentContract && !props.documentContract.isClosed)) && !props.isDPPPhaseFinalized && (
              <IconButton className="bg-red-500 text-white hover:bg-white hover:text-red-600" text={"Odstrani"}
                          icon={<FaTimes/>} onClick={() => handleRemoveAssessmentProvider()}/>
          )}
        </div>)}
      </div>
    </div>
  );
};

export default AssessmentProviderInfoPopup;
